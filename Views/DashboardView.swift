import Charts
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var appState: AppState
    @Binding var isAddingEntry: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    summaryGrid
                    expenseChart
                    recentEntries
                }
                .padding()
                .padding(.bottom, 96)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Harcamac")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isAddingEntry = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                    .accessibilityLabel("Yeni kayıt")
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Bu ay")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text(appState.monthlyNet.currencyText)
                .font(.largeTitle.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.72)

            Text(netSummaryText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(AppTheme.primary.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var netSummaryText: String {
        if appState.monthlyEntries.isEmpty {
            return "Henüz bu ay kayıt yok."
        }
        return appState.monthlyNet >= 0 ? "Gelirlerin giderlerinden yüksek." : "Bu ay giderlerin gelirlerinden yüksek."
    }

    private var summaryGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            MetricCard(title: "Gelir", value: appState.monthlyIncome.currencyText, tint: AppTheme.income)
            MetricCard(title: "Gider", value: appState.monthlyExpense.currencyText, tint: AppTheme.expense)
            MetricCard(title: "Net", value: appState.monthlyNet.currencyText, tint: AppTheme.primary)
            MetricCard(title: "Varlık", value: appState.assetTotal.currencyText, tint: .indigo)
        }
    }

    private var expenseChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Kategori Dağılımı")
                .font(.headline)

            if appState.expenseCategories.isEmpty {
                ContentUnavailableView(
                    "Henüz gider yok",
                    systemImage: "chart.pie",
                    description: Text("Kategorilere göre grafik görmek için gider ekle.")
                )
            } else {
                Chart(appState.expenseCategories) { item in
                    SectorMark(
                        angle: .value("Tutar", NSDecimalNumber(decimal: item.total).doubleValue),
                        innerRadius: .ratio(0.58),
                        angularInset: 1.5
                    )
                    .foregroundStyle(by: .value("Kategori", item.category))
                }
                .frame(height: 220)

                VStack(spacing: 8) {
                    ForEach(appState.expenseCategories.prefix(5)) { item in
                        HStack {
                            Text(item.category)
                            Spacer()
                            Text(item.total.currencyText)
                                .foregroundStyle(.secondary)
                        }
                        .font(.subheadline)
                    }
                }
            }
        }
        .padding()
        .background(AppTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var recentEntries: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Son Hareketler")
                .font(.headline)

            if appState.entries.isEmpty {
                ContentUnavailableView(
                    "Kayıt yok",
                    systemImage: "tray",
                    description: Text("Sağ üstteki artı düğmesiyle ilk gelir veya giderini ekleyebilirsin.")
                )
            } else {
                ForEach(appState.entries.prefix(5)) { entry in
                    EntryRow(entry: entry)
                }
            }
        }
        .padding()
        .background(AppTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

private struct MetricCard: View {
    let title: String
    let value: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(tint.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
