import Foundation
import SwiftUI

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

    @Published var categoriesByGroup: [String: [String]] {
        didSet { Self.save(categoriesByGroup, key: StorageKey.categories) }
    }

    @Published var enabledCharts: [DashboardChartKind] {
        didSet { Self.save(enabledCharts, key: StorageKey.enabledCharts) }
    }

    @Published var isCatPopupEnabled: Bool {
        didSet { UserDefaults.standard.set(isCatPopupEnabled, forKey: StorageKey.catPopupEnabled) }
    }

    @Published var catPopup: String?

    private let calendar = Calendar.current

    init() {
        entries = Self.load([FinanceEntry].self, key: StorageKey.entries) ?? []
        holdings = Self.load([AssetHolding].self, key: StorageKey.holdings) ?? []

        let storedTheme = UserDefaults.standard.string(forKey: StorageKey.themeMode)
        themeMode = AppThemeMode(rawValue: storedTheme ?? "") ?? .system
        categoriesByGroup = Self.load([String: [String]].self, key: StorageKey.categories) ?? Self.defaultCategories
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
        let grouped = Dictionary(grouping: monthlyEntries.filter { $0.kind == .expense }, by: \.category)
        return grouped
            .map { CategorySummary(category: $0.key, total: $0.value.reduce(0) { $0 + $1.amount }) }
            .sorted { $0.total > $1.total }
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
                $0.kind == .expense && calendar.isDate($0.date, equalTo: weekDate, toGranularity: .weekOfYear)
            }
            return WeekSummary(week: formatter.string(from: weekDate), expense: entriesInWeek.reduce(0) { $0 + $1.amount })
        }
    }

    var recurringEntries: [FinanceEntry] {
        entries.filter { $0.cadence == .recurring }
    }

    func addEntry(_ entry: FinanceEntry) {
        entries.insert(entry, at: 0)
        showCatPopup(for: entry.kind)
    }

    func updateEntry(_ entry: FinanceEntry) {
        guard let index = entries.firstIndex(where: { $0.id == entry.id }) else { return }
        entries[index] = entry
    }

    func deleteEntry(_ entry: FinanceEntry) {
        entries.removeAll { $0.id == entry.id }
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

    func categories(for kind: MoneyFlowKind, cadence: EntryCadence) -> [String] {
        categoriesByGroup[CategoryGroup(kind: kind, cadence: cadence).storageKey] ?? []
    }

    func addCategory(_ category: String, kind: MoneyFlowKind, cadence: EntryCadence) {
        let trimmed = category.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let key = CategoryGroup(kind: kind, cadence: cadence).storageKey
        var categories = categoriesByGroup[key] ?? []
        guard !categories.contains(where: { $0.localizedCaseInsensitiveCompare(trimmed) == .orderedSame }) else { return }
        categories.append(trimmed)
        categoriesByGroup[key] = categories.sorted { $0.localizedCompare($1) == .orderedAscending }
    }

    func deleteCategory(_ category: String, kind: MoneyFlowKind, cadence: EntryCadence) {
        let key = CategoryGroup(kind: kind, cadence: cadence).storageKey
        categoriesByGroup[key]?.removeAll { $0 == category }
    }

    func toggleChart(_ chart: DashboardChartKind) {
        if enabledCharts.contains(chart) {
            enabledCharts.removeAll { $0 == chart }
        } else {
            enabledCharts.append(chart)
        }
    }

    private func total(for kind: MoneyFlowKind, in entries: [FinanceEntry]) -> Decimal {
        entries
            .filter { $0.kind == kind }
            .reduce(0) { $0 + $1.amount }
    }

    private func saveEntries() {
        Self.save(entries, key: StorageKey.entries)
    }

    private func saveHoldings() {
        Self.save(holdings, key: StorageKey.holdings)
    }

    private func showCatPopup(for kind: MoneyFlowKind) {
        guard isCatPopupEnabled else { return }
        catPopup = kind == .income ? "😺 Gelir eklendi" : "😿 Harcama eklendi"
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
    static var defaultCategories: [String: [String]] {
        var result: [String: [String]] = [:]
        result[CategoryGroup(kind: .expense, cadence: .oneTime).storageKey] = ["Market", "Ulaşım", "Yeme İçme", "Sağlık", "Sosyal", "Alışveriş"]
        result[CategoryGroup(kind: .expense, cadence: .recurring).storageKey] = ["Kira", "Fatura", "Abonelik", "Aidat", "Sigorta"]
        result[CategoryGroup(kind: .income, cadence: .oneTime).storageKey] = ["Ek Gelir", "Satış", "Prim", "Hediye"]
        result[CategoryGroup(kind: .income, cadence: .recurring).storageKey] = ["Maaş", "Kira Geliri", "Temettü", "Faiz"]
        return result
    }
}
