import Foundation
import SwiftUI
import UserNotifications

@MainActor
final class AppState: ObservableObject {
    @Published var entries: [FinanceEntry] {
        didSet { saveEntries() }
    }

    @Published var holdings: [AssetHolding] {
        didSet { saveHoldings() }
    }

    @Published var themeMode: AppThemeMode {
        didSet { UserDefaults.standard.set(themeMode.rawValue, forKey: StorageKey.themeMode) }
    }

    @Published var categoriesByGroup: [String: [CategoryItem]] {
        didSet { Self.save(categoriesByGroup, key: StorageKey.categories) }
    }

    @Published var enabledCharts: [DashboardChartKind] {
        didSet { Self.save(enabledCharts, key: StorageKey.enabledCharts) }
    }

    @Published var isCatPopupEnabled: Bool {
        didSet { UserDefaults.standard.set(isCatPopupEnabled, forKey: StorageKey.catPopupEnabled) }
    }

    @Published var catPopup: CatPopupKind?

    private let calendar = Calendar.current

    init() {
        entries = Self.load([FinanceEntry].self, key: StorageKey.entries) ?? []
        holdings = Self.load([AssetHolding].self, key: StorageKey.holdings) ?? []

        let storedTheme = UserDefaults.standard.string(forKey: StorageKey.themeMode)
        themeMode = AppThemeMode(rawValue: storedTheme ?? "") ?? .system
        categoriesByGroup = Self.cleanedCategories(Self.load([String: [CategoryItem]].self, key: StorageKey.categories) ?? Self.defaultCategories)
        enabledCharts = Self.load([DashboardChartKind].self, key: StorageKey.enabledCharts) ?? DashboardChartKind.allCases
        isCatPopupEnabled = UserDefaults.standard.object(forKey: StorageKey.catPopupEnabled) as? Bool ?? true
        catPopup = nil
    }

    var monthlyEntries: [FinanceEntry] {
        entries.filter { calendar.isDate($0.date, equalTo: .now, toGranularity: .month) }
    }

    var monthlyIncome: Decimal {
        total(for: .income, in: monthlyEntries)
    }

    var monthlyExpense: Decimal {
        total(for: .expense, in: monthlyEntries)
    }

    var monthlyNet: Decimal {
        monthlyIncome - monthlyExpense
    }

    var assetTotal: Decimal {
        holdings.reduce(0) { $0 + $1.marketValue }
    }

    var expenseCategories: [CategorySummary] {
        categorySummaries(for: .expense, in: monthlyEntries)
    }

    var incomeCategories: [CategorySummary] {
        categorySummaries(for: .income, in: monthlyEntries)
    }

    var monthlyTrend: [MonthSummary] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.dateFormat = "MMM"

        return (0..<6).reversed().compactMap { offset in
            guard let monthDate = calendar.date(byAdding: .month, value: -offset, to: .now) else { return nil }
            let entriesInMonth = entries.filter { calendar.isDate($0.date, equalTo: monthDate, toGranularity: .month) }
            return MonthSummary(
                month: formatter.string(from: monthDate),
                income: total(for: .income, in: entriesInMonth),
                expense: total(for: .expense, in: entriesInMonth)
            )
        }
    }

    var weeklyExpenseTrend: [WeekSummary] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.dateFormat = "d MMM"

        return (0..<4).reversed().compactMap { offset in
            guard let weekDate = calendar.date(byAdding: .weekOfYear, value: -offset, to: .now) else { return nil }
            let entriesInWeek = entries.filter {
                calendar.isDate($0.date, equalTo: weekDate, toGranularity: .weekOfYear)
            }
            return WeekSummary(
                week: formatter.string(from: weekDate),
                income: total(for: .income, in: entriesInWeek),
                expense: total(for: .expense, in: entriesInWeek)
            )
        }
    }

    var recurringEntries: [FinanceEntry] {
        entries.filter { $0.cadence == .recurring }
    }

    var recurringIncomeCategories: [CategorySummary] {
        categorySummaries(for: .income, cadence: .recurring)
    }

    var recurringExpenseCategories: [CategorySummary] {
        categorySummaries(for: .expense, cadence: .recurring)
    }

    func addEntry(_ entry: FinanceEntry) {
        entries.insert(entry, at: 0)
        scheduleNotificationIfNeeded(for: entry)
        showCatPopup(for: entry.kind)
    }

    func updateEntry(_ entry: FinanceEntry) {
        guard let index = entries.firstIndex(where: { $0.id == entry.id }) else { return }
        entries[index] = entry
        removeNotification(for: entry)
        scheduleNotificationIfNeeded(for: entry)
    }

    func deleteEntry(_ entry: FinanceEntry) {
        entries.removeAll { $0.id == entry.id }
        removeNotification(for: entry)
    }

    func addHolding(_ holding: AssetHolding) {
        holdings.insert(holding, at: 0)
    }

    var preferredColorScheme: ColorScheme? {
        switch themeMode {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    func categories(for kind: MoneyFlowKind, cadence: EntryCadence) -> [CategoryItem] {
        categoriesByGroup[CategoryGroup(kind: kind, cadence: cadence).storageKey] ?? []
    }

    func categoryNames(for kind: MoneyFlowKind, cadence: EntryCadence) -> [String] {
        categories(for: kind, cadence: cadence).map(\.name)
    }

    func addCategory(_ category: String, colorHex: String, kind: MoneyFlowKind, cadence: EntryCadence) {
        let trimmed = category.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let key = CategoryGroup(kind: kind, cadence: cadence).storageKey
        var categories = categoriesByGroup[key] ?? []
        guard !categories.contains(where: { $0.name.localizedCaseInsensitiveCompare(trimmed) == .orderedSame }) else { return }
        categories.append(CategoryItem(name: trimmed, colorHex: colorHex))
        categoriesByGroup[key] = categories.sorted { $0.name.localizedCompare($1.name) == .orderedAscending }
    }

    func deleteCategory(_ category: String, kind: MoneyFlowKind, cadence: EntryCadence) {
        let key = CategoryGroup(kind: kind, cadence: cadence).storageKey
        categoriesByGroup[key]?.removeAll { $0.name == category }
    }

    func colorHex(for category: String, kind: MoneyFlowKind, cadence: EntryCadence?) -> String {
        let cadences = cadence.map { [$0] } ?? EntryCadence.allCases
        for cadence in cadences {
            if let color = categories(for: kind, cadence: cadence).first(where: { $0.name == category })?.colorHex {
                return color
            }
        }
        return kind == .income ? "#198754" : "#C0392B"
    }

    func toggleChart(_ chart: DashboardChartKind) {
        if enabledCharts.contains(chart) {
            enabledCharts.removeAll { $0 == chart }
        } else {
            enabledCharts.append(chart)
        }
    }

    func replaceChart(_ oldChart: DashboardChartKind, with newChart: DashboardChartKind) {
        guard let index = enabledCharts.firstIndex(of: oldChart) else { return }
        if enabledCharts.contains(newChart), oldChart != newChart {
            enabledCharts.remove(at: index)
        } else {
            enabledCharts[index] = newChart
        }
    }

    private func total(for kind: MoneyFlowKind, in entries: [FinanceEntry]) -> Decimal {
        entries
            .filter { $0.kind == kind }
            .reduce(0) { $0 + $1.amount }
    }

    private func categorySummaries(for kind: MoneyFlowKind, cadence: EntryCadence) -> [CategorySummary] {
        let grouped = Dictionary(grouping: entries.filter { $0.kind == kind && $0.cadence == cadence }, by: \.category)
        return grouped
            .map { CategorySummary(category: $0.key, total: $0.value.reduce(0) { $0 + $1.amount }, colorHex: colorHex(for: $0.key, kind: kind, cadence: cadence)) }
            .sorted { $0.total > $1.total }
    }

    private func categorySummaries(for kind: MoneyFlowKind, in entries: [FinanceEntry]) -> [CategorySummary] {
        let grouped = Dictionary(grouping: entries.filter { $0.kind == kind }, by: \.category)
        return grouped
            .map { CategorySummary(category: $0.key, total: $0.value.reduce(0) { $0 + $1.amount }, colorHex: colorHex(for: $0.key, kind: kind, cadence: nil)) }
            .sorted { $0.total > $1.total }
    }

    private func saveEntries() {
        Self.save(entries, key: StorageKey.entries)
    }

    private func saveHoldings() {
        Self.save(holdings, key: StorageKey.holdings)
    }

    private func showCatPopup(for kind: MoneyFlowKind) {
        guard isCatPopupEnabled else { return }
        catPopup = kind == .income ? .income : .expense
    }

    private func scheduleNotificationIfNeeded(for entry: FinanceEntry) {
        guard entry.cadence == .recurring, entry.notificationEnabled else { return }

        let identifier = notificationID(for: entry)

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }

            let content = UNMutableNotificationContent()
            content.title = entry.kind == .expense ? "\(entry.title) gideriniz yaklaştı" : "\(entry.title) geliriniz yaklaştı"
            content.body = "\(entry.amount.currencyText) tutarındaki düzenli \(entry.kind.rawValue.lowercased()) kaydınızı kontrol edin."
            content.sound = .default

            let day = Calendar.current.component(.day, from: entry.date)
            var dateComponents = DateComponents()
            dateComponents.day = day
            dateComponents.hour = 9
            dateComponents.minute = 0

            let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
            let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
            UNUserNotificationCenter.current().add(request)
        }
    }

    private func removeNotification(for entry: FinanceEntry) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [notificationID(for: entry)])
    }

    private func notificationID(for entry: FinanceEntry) -> String {
        "harcamac.recurring.\(entry.id.uuidString)"
    }

    private static func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func save<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}

private enum StorageKey {
    static let entries = "harcamac.entries"
    static let holdings = "harcamac.holdings"
    static let themeMode = "harcamac.themeMode"
    static let categories = "harcamac.categories"
    static let enabledCharts = "harcamac.enabledCharts"
    static let catPopupEnabled = "harcamac.catPopupEnabled"
}

private extension AppState {
    static func cleanedCategories(_ stored: [String: [CategoryItem]]) -> [String: [CategoryItem]] {
        var result = stored
        let oneTimeIncomeKey = CategoryGroup(kind: .income, cadence: .oneTime).storageKey
        let recurringIncomeKey = CategoryGroup(kind: .income, cadence: .recurring).storageKey
        let oldOneTimeIncome = Set(["Ek Gelir", "Satış", "Prim", "Hediye"])

        if Set(result[oneTimeIncomeKey]?.map(\.name) ?? []) == oldOneTimeIncome {
            result[oneTimeIncomeKey] = defaultCategories[oneTimeIncomeKey]
        }

        if result[recurringIncomeKey]?.isEmpty ?? true {
            result[recurringIncomeKey] = defaultCategories[recurringIncomeKey]
        }

        return result
    }

    static var defaultCategories: [String: [CategoryItem]] {
        var result: [String: [CategoryItem]] = [:]
        result[CategoryGroup(kind: .expense, cadence: .oneTime).storageKey] = [
            CategoryItem(name: "Market", colorHex: "#F94144"),
            CategoryItem(name: "Ulaşım", colorHex: "#F3722C"),
            CategoryItem(name: "Yeme İçme", colorHex: "#F8961E"),
            CategoryItem(name: "Sağlık", colorHex: "#B5179E"),
            CategoryItem(name: "Sosyal", colorHex: "#7209B7"),
            CategoryItem(name: "Alışveriş", colorHex: "#4361EE")
        ]
        result[CategoryGroup(kind: .expense, cadence: .recurring).storageKey] = [
            CategoryItem(name: "Kira", colorHex: "#C1121F"),
            CategoryItem(name: "Fatura", colorHex: "#E85D04"),
            CategoryItem(name: "Abonelik", colorHex: "#9D4EDD"),
            CategoryItem(name: "Aidat", colorHex: "#3A86FF"),
            CategoryItem(name: "Sigorta", colorHex: "#FF006E")
        ]
        result[CategoryGroup(kind: .income, cadence: .oneTime).storageKey] = [
            CategoryItem(name: "Maaş", colorHex: "#007F5F"),
            CategoryItem(name: "Avans", colorHex: "#2A9D8F"),
            CategoryItem(name: "Serbest İş", colorHex: "#52B788"),
            CategoryItem(name: "Kira Geliri", colorHex: "#00B4D8"),
            CategoryItem(name: "Yatırım Geliri", colorHex: "#55A630")
        ]
        result[CategoryGroup(kind: .income, cadence: .recurring).storageKey] = [
            CategoryItem(name: "Maaş", colorHex: "#007F5F"),
            CategoryItem(name: "Kira Geliri", colorHex: "#2B9348"),
            CategoryItem(name: "Temettü", colorHex: "#55A630"),
            CategoryItem(name: "Faiz", colorHex: "#0A9396")
        ]
        return result
    }
}
