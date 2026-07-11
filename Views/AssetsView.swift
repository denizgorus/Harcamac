import SwiftUI

struct AssetsView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        Text("Toplam Varlık")
                            .font(.headline)
                        Spacer()
                        Text(appState.assetTotal.currencyText)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(AppTheme.primary)
                    }
                    .padding(.vertical, 6)
                }

                Section("Varlıklar") {
                    if appState.holdings.isEmpty {
                        ContentUnavailableView(
                            "Varlık yok",
                            systemImage: "briefcase",
                            description: Text("Varlık ekleme ekranı sonraki adımda bağlanacak.")
                        )
                    } else {
                        ForEach(appState.holdings) { holding in
                            HoldingRow(holding: holding)
                        }
                    }
                }
            }
            .navigationTitle("Varlıklar")
        }
    }
}

private struct HoldingRow: View {
    let holding: AssetHolding

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(holding.name)
                        .font(.body)
                    Text("\(holding.symbol) • \(holding.kind.rawValue)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(holding.marketValue.currencyText)
                    .font(.subheadline.weight(.semibold))
            }

            HStack {
                Text("Adet: \(NSDecimalNumber(decimal: holding.units).stringValue)")
                Spacer()
                Text("Kâr/Zarar: \(holding.gainLoss.currencyText)")
                    .foregroundStyle(holding.gainLoss >= 0 ? AppTheme.income : AppTheme.expense)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
