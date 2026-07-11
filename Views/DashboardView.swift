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
                    chartSections
                    recentEntries
                }
                .padding()
                .padding(.bottom, 96)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Harcamac")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack {
                        Menu {
                            ForEach(DashboardChartKind.allCases.filter { !appState.enabledCharts.contains($0) }) { chart in
                                Button(chart.rawValue) {
                                    appState.toggleChart(chart)
                                }
                            }
                        } label: {
                            Image(systemName: "chart.bar.doc.horizontal")
                        }
                        .accessibilityLabel("Grafik ekle")

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

    @ViewBuilder
    private var chartSections: some View {
        if appState.enabledCharts.isEmpty {
            InfoCard(title: "Grafik yok", systemImage: "chart.bar", message: "Sağ üstteki grafik düğmesinden özet grafiklerini açabilirsin.")
        } else {
            ForEach(appState.enabledCharts) { chart in
                switch chart {
                case .monthlyExpensePie:
                    removableChart(chart) { expensePieChart }
                case .monthlyIncomeExpenseBar:
                    removableChart(chart) { monthlyIncomeExpenseChart }
                case .weeklyExpenseBar:
                    removableChart(chart) { weeklyExpenseChart }
                case .categoryExpenseBar:
                    removableChart(chart) { categoryExpenseBarChart }
                }
            }
        }
    }

    private func removableChart<Content: View>(_ chart: DashboardChartKind, @ViewBuilder content: () -> Content) -> some View {
        SwipeRemovableChart {
            appState.toggleChart(chart)
        } content: {
            content()
        }
    }

    private var expensePieChart: some View {
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
                    .foregroundStyle(Color(hex: item.colorHex))
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

    private var monthlyIncomeExpenseChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Aylara Göre Gelir ve Gider")
                .font(.headline)

            if appState.monthlyTrend.allSatisfy({ $0.income == 0 && $0.expense == 0 }) {
                ContentUnavailableView("Grafik için kayıt yok", systemImage: "chart.bar")
            } else {
                Chart(appState.monthlyTrend) { item in
                    BarMark(
                        x: .value("Ay", item.month),
                        y: .value("Gelir", NSDecimalNumber(decimal: item.income).doubleValue)
                    )
                    .foregroundStyle(AppTheme.income)
                    .position(by: .value("Tip", "Gelir"))

                    BarMark(
                        x: .value("Ay", item.month),
                        y: .value("Gider", NSDecimalNumber(decimal: item.expense).doubleValue)
                    )
                    .foregroundStyle(AppTheme.expense)
                    .position(by: .value("Tip", "Gider"))
                }
                .frame(height: 220)
            }
        }
        .padding()
        .background(AppTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var weeklyExpenseChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Haftalık Harcama")
                .font(.headline)

            if appState.weeklyExpenseTrend.allSatisfy({ $0.expense == 0 }) {
                ContentUnavailableView("Haftalık gider yok", systemImage: "chart.bar.xaxis")
            } else {
                Chart(appState.weeklyExpenseTrend) { item in
                    BarMark(
                        x: .value("Hafta", item.week),
                        y: .value("Gider", NSDecimalNumber(decimal: item.expense).doubleValue)
                    )
                    .foregroundStyle(AppTheme.expense)
                }
                .frame(height: 200)
            }
        }
        .padding()
        .background(AppTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var categoryExpenseBarChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Kategoriye Göre Harcama")
                .font(.headline)

            if appState.expenseCategories.isEmpty {
                ContentUnavailableView("Kategori gideri yok", systemImage: "chart.bar")
            } else {
                Chart(appState.expenseCategories) { item in
                    BarMark(
                        x: .value("Kategori", item.category),
                        y: .value("Tutar", NSDecimalNumber(decimal: item.total).doubleValue)
                    )
                    .foregroundStyle(Color(hex: item.colorHex))
                }
                .frame(height: 220)
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

private struct InfoCard: View {
    let title: String
    let systemImage: String
    let message: String

    var body: some View {
        ContentUnavailableView(title, systemImage: systemImage, description: Text(message))
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

private struct SwipeRemovableChart<Content: View>: View {
    let onRemove: () -> Void
    let content: Content
    @State private var offset: CGFloat = 0

    init(onRemove: @escaping () -> Void, @ViewBuilder content: () -> Content) {
        self.onRemove = onRemove
        self.content = content()
    }

    var body: some View {
        ZStack(alignment: .trailing) {
            Button(role: .destructive) {
                withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
                    onRemove()
                }
            } label: {
                Label("Kaldır", systemImage: "trash")
                    .labelStyle(.iconOnly)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 76)
                    .frame(maxHeight: .infinity)
                    .background(AppTheme.expense)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            content
                .offset(x: offset)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            offset = max(-84, min(0, value.translation.width))
                        }
                        .onEnded { value in
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
                                offset = value.translation.width < -44 ? -84 : 0
                            }
                        }
                )
        }
        .clipped()
    }
}
