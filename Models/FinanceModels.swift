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

struct FinanceEntry: Identifiable, Hashable, Codable {
    let id: UUID
    var title: String
    var category: String
    var amount: Decimal
    var kind: MoneyFlowKind
    var cadence: EntryCadence
    var date: Date
    var note: String

    init(
        id: UUID = UUID(),
        title: String,
        category: String,
        amount: Decimal,
        kind: MoneyFlowKind,
        cadence: EntryCadence,
        date: Date = .now,
        note: String = ""
    ) {
        self.id = id
        self.title = title
        self.category = category
        self.amount = amount
        self.kind = kind
        self.cadence = cadence
        self.date = date
        self.note = note
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
}

enum AppThemeMode: String, CaseIterable, Identifiable, Codable {
    case system = "Sistem"
    case light = "Açık"
    case dark = "Koyu"

    var id: String { rawValue }
}
