import Foundation

@MainActor
final class AppState: ObservableObject {
    @Published var entries: [FinanceEntry]
    @Published var holdings: [AssetHolding]

    private let calendar = Calendar.current

    init() {
        entries = [
            FinanceEntry(title: "Maas", category: "Gelir", amount: 65000, kind: .income, cadence: .recurring, date: .now),
            FinanceEntry(title: "Kira", category: "Ev", amount: 22000, kind: .expense, cadence: .recurring, date: .now),
            FinanceEntry(title: "Elektrik", category: "Fatura", amount: 980, kind: .expense, cadence: .recurring, date: .now),
            FinanceEntry(title: "Netflix", category: "Abonelik", amount: 230, kind: .expense, cadence: .recurring, date: .now),
            FinanceEntry(title: "Market", category: "Gida", amount: 1850, kind: .expense, cadence: .oneTime, date: .now),
            FinanceEntry(title: "Kahve", category: "Sosyal", amount: 210, kind: .expense, cadence: .oneTime, date: .now),
            FinanceEntry(title: "Freelance", category: "Ek Gelir", amount: 8500, kind: .income, cadence: .oneTime, date: .now)
        ]

        holdings = [
            AssetHolding(name: "Turk Lirasi", symbol: "TRY", kind: .bank, units: 1, averageCost: 18000, currentPrice: 18000),
            AssetHolding(name: "Gram Altin", symbol: "XAUTRYG", kind: .gold, units: 8.5, averageCost: 2450, currentPrice: 2620),
            AssetHolding(name: "Apple", symbol: "AAPL", kind: .stock, units: 3, averageCost: 185, currentPrice: 208)
        ]
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

    private func total(for kind: MoneyFlowKind, in entries: [FinanceEntry]) -> Decimal {
        entries
            .filter { $0.kind == kind }
            .reduce(0) { $0 + $1.amount }
    }
}
