import SwiftUI

enum AppTheme {
    static let primary = Color(red: 0.05, green: 0.38, blue: 0.36)
    static let income = Color(red: 0.10, green: 0.55, blue: 0.25)
    static let expense = Color(red: 0.78, green: 0.18, blue: 0.18)
    static let surface = Color(.secondarySystemGroupedBackground)
}

extension Decimal {
    var currencyText: String {
        let number = NSDecimalNumber(decimal: self)
        return number.currencyFormatter.string(from: number) ?? "\(number)"
    }
}

private extension NSNumber {
    var currencyFormatter: NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "TRY"
        formatter.maximumFractionDigits = 2
        return formatter
    }
}
