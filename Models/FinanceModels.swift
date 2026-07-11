import Foundation
import SwiftUI

enum MoneyFlowKind: String, CaseIterable, Identifiable, Codable {
    case expense = "Gider"
    case income = "Gelir"

    var id: String { rawValue }

    var color: Color {
        switch self {
        case .expense: .red
        case .income: .green
        }
    }
}

enum EntryCadence: String, CaseIterable, Identifiable, Codable {
    case oneTime = "Tek seferlik"
    case recurring = "Düzenli"

    var id: String { rawValue }
}

enum PaymentType: String, CaseIterable, Identifiable, Codable {
    case cash = "Peşin"
    case installment = "Taksit"

    var id: String { rawValue }
}

struct CategoryGroup: Hashable, Codable {
    var kind: MoneyFlowKind
    var cadence: EntryCadence

    var title: String {
        "\(cadence.rawValue) \(kind.rawValue)"
    }

    var storageKey: String {
        "\(kind.rawValue)-\(cadence.rawValue)"
    }
}

struct CategoryItem: Identifiable, Hashable, Codable {
    var id: String { name }
    var name: String
    var colorHex: String
}

struct FinanceEntry: Identifiable, Hashable, Codable {
    let id: UUID
    var title: String
    var category: String
    var amount: Decimal
    var kind: MoneyFlowKind
    var cadence: EntryCadence
    var date: Date
    var note: String
    var installmentCount: Int?
    var totalAmount: Decimal?
    var notificationEnabled: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case category
        case amount
        case kind
        case cadence
        case date
        case note
        case installmentCount
        case totalAmount
        case notificationEnabled
    }

    init(
        id: UUID = UUID(),
        title: String,
        category: String,
        amount: Decimal,
        kind: MoneyFlowKind,
        cadence: EntryCadence,
        date: Date = .now,
        note: String = "",
        installmentCount: Int? = nil,
        totalAmount: Decimal? = nil,
        notificationEnabled: Bool = false
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.amount = amount
        self.kind = kind
        self.cadence = cadence
        self.date = date
        self.note = note
        self.installmentCount = installmentCount
        self.totalAmount = totalAmount
        self.notificationEnabled = notificationEnabled
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        category = try container.decode(String.self, forKey: .category)
        amount = try container.decode(Decimal.self, forKey: .amount)
        kind = try container.decode(MoneyFlowKind.self, forKey: .kind)
        cadence = try container.decode(EntryCadence.self, forKey: .cadence)
        date = try container.decode(Date.self, forKey: .date)
        note = try container.decodeIfPresent(String.self, forKey: .note) ?? ""
        installmentCount = try container.decodeIfPresent(Int.self, forKey: .installmentCount)
        totalAmount = try container.decodeIfPresent(Decimal.self, forKey: .totalAmount)
        notificationEnabled = try container.decodeIfPresent(Bool.self, forKey: .notificationEnabled) ?? false
    }

    var installmentDescription: String? {
        guard let installmentCount, installmentCount > 1 else { return nil }
        let total = totalAmount ?? amount * Decimal(installmentCount)
        return "\(installmentCount) taksit - toplam \(total.currencyText)"
    }
}

enum AssetKind: String, CaseIterable, Identifiable, Codable {
    case cash = "Nakit"
    case bank = "Banka"
    case stock = "Hisse"
    case gold = "Altın"
    case crypto = "Kripto"
    case other = "Diğer"

    var id: String { rawValue }
}

struct AssetHolding: Identifiable, Hashable, Codable {
    let id: UUID
    var name: String
    var symbol: String
    var kind: AssetKind
    var units: Decimal
    var averageCost: Decimal
    var currentPrice: Decimal

    init(
        id: UUID = UUID(),
        name: String,
        symbol: String,
        kind: AssetKind,
        units: Decimal,
        averageCost: Decimal,
        currentPrice: Decimal
    ) {
        self.id = id
        self.name = name
        self.symbol = symbol
        self.kind = kind
        self.units = units
        self.averageCost = averageCost
        self.currentPrice = currentPrice
    }

    var marketValue: Decimal {
        units * currentPrice
    }

    var gainLoss: Decimal {
        (currentPrice - averageCost) * units
    }
}

struct CategorySummary: Identifiable {
    let id = UUID()
    let category: String
    let total: Decimal
    let colorHex: String
}

enum CatPopupKind: Equatable {
    case income
    case expense

    var title: String {
        switch self {
        case .income: "Gelir eklendi"
        case .expense: "Gider eklendi"
        }
    }

    var imageName: String {
        switch self {
        case .income: "happy-cat"
        case .expense: "sad-cat"
        }
    }
}

enum AppThemeMode: String, CaseIterable, Identifiable, Codable {
    case system = "Sistem"
    case light = "Açık"
    case dark = "Koyu"

    var id: String { rawValue }
}

enum DashboardChartKind: String, CaseIterable, Identifiable, Codable {
    case monthlyExpensePie = "Aylık gider pasta grafiği"
    case monthlyIncomeExpenseBar = "Aylık gelir/gider sütun grafiği"
    case weeklyExpenseBar = "Haftalık gider sütun grafiği"
    case categoryExpenseBar = "Kategoriye göre gider grafiği"
    case categoryIncomePie = "Kategoriye göre gelir pasta grafiği"
    case categoryIncomeBar = "Kategoriye göre gelir sütun grafiği"
    case weeklyIncomeBar = "Haftalık gelir sütun grafiği"
    case monthlyExpenseBar = "Aylık gider sütun grafiği"
    case monthlyIncomeBar = "Aylık gelir sütun grafiği"

    var id: String { rawValue }

    var shortTitle: String {
        switch self {
        case .monthlyExpensePie: "Aylık Gider Pasta"
        case .monthlyIncomeExpenseBar: "Aylık Gelir/Gider"
        case .weeklyExpenseBar: "Haftalık Gider"
        case .categoryExpenseBar: "Kategori Gider"
        case .categoryIncomePie: "Kategori Gelir Pasta"
        case .categoryIncomeBar: "Kategori Gelir"
        case .weeklyIncomeBar: "Haftalık Gelir"
        case .monthlyExpenseBar: "Aylık Gider"
        case .monthlyIncomeBar: "Aylık Gelir"
        }
    }
}

struct MonthSummary: Identifiable {
    let id = UUID()
    let month: String
    let income: Decimal
    let expense: Decimal
}

struct WeekSummary: Identifiable {
    let id = UUID()
    let week: String
    let income: Decimal
    let expense: Decimal
}
