import SwiftUI
import UIKit

enum AppTheme {
    static let primary = Color(red: 0.05, green: 0.38, blue: 0.36)
    static let income = Color(red: 0.10, green: 0.55, blue: 0.25)
    static let expense = Color(red: 0.78, green: 0.18, blue: 0.18)
    static let warning = Color(red: 0.86, green: 0.56, blue: 0.12)
    static let surface = Color(.secondarySystemGroupedBackground)
}

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        let value = UInt64(cleaned, radix: 16) ?? 0
        let red = Double((value >> 16) & 0xFF) / 255
        let green = Double((value >> 8) & 0xFF) / 255
        let blue = Double(value & 0xFF) / 255
        self.init(red: red, green: green, blue: blue)
    }

    var hexString: String {
        let uiColor = UIColor(self)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        uiColor.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return String(format: "#%02X%02X%02X", Int(red * 255), Int(green * 255), Int(blue * 255))
    }
}

extension Decimal {
    var currencyText: String {
        let number = NSDecimalNumber(decimal: self)
        return NumberFormatter.turkishLira.string(from: number) ?? "\(number) TL"
    }
}

private extension NumberFormatter {
    static var turkishLira: NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.currencyCode = "TRY"
        formatter.maximumFractionDigits = 2
        return formatter
    }
}
