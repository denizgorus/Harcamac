import Charts
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    summaryGrid
                    expenseChart
                    recentEntries
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Harcamac")
        }
    }

    private var summaryGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            MetricCard(title: "Gelir", value: appState.monthlyIncome.currencyText, tint: AppTheme.income)
            MetricCard(title: "Gider", value: appState.monthlyExpense.currencyText, tint: AppTheme.expense)
            MetricCard(title: "Net", value: appState.monthlyNet.currencyText, tint: AppTheme.primary)
            MetricCard(title: "Varlik", value: appState.assetTotal.currencyText, tint: .indigo)
        }
    }

    private var expenseChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Kategori Dagilimi")
                .font(.headline)

            if appState.expenseCategories.isEmpty {
                ContentUnavailableView("Gider yok", systemImage: "chart.pie")
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

            ForEach(appState.entries.prefix(5)) { entry in
                EntryRow(entry: entry)
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
