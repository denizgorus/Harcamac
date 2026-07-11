import Foundation

struct MarketQuote: Identifiable, Hashable {
    var id: String { symbol }
    let symbol: String
    let price: Decimal
    let updatedAt: Date
}

protocol MarketPriceProviding {
    func quotes(for symbols: [String]) async throws -> [MarketQuote]
}

struct MockMarketPriceService: MarketPriceProviding {
    func quotes(for symbols: [String]) async throws -> [MarketQuote] {
        symbols.map { symbol in
            MarketQuote(symbol: symbol, price: mockPrice(for: symbol), updatedAt: .now)
        }
    }

    private func mockPrice(for symbol: String) -> Decimal {
        switch symbol.uppercased() {
        case "XAUTRYG": 2620
        case "AAPL": 208
        case "TRY": 1
        default: 100
        }
    }
}
