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

    private let calendar = Calendar.current

    init() {
        entries = Self.load([FinanceEntry].self, key: StorageKey.entries) ?? []
        holdings = Self.load([AssetHolding].self, key: StorageKey.holdings) ?? []

        let storedTheme = UserDefaults.standard.string(forKey: StorageKey.themeMode)
        themeMode = AppThemeMode(rawValue: storedTheme ?? "") ?? .system
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

    var recurringEntries: [FinanceEntry] {
        entries.filter { $0.cadence == .recurring }
    }

    func addEntry(_ entry: FinanceEntry) {
        entries.insert(entry, at: 0)
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
}
