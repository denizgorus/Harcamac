import Charts
import SwiftUI

struct RecurringView: View {
    @EnvironmentObject private var appState: AppState
    @State private var editingEntry: FinanceEntry?

    var body: some View {
        NavigationStack {
            List {
                if !appState.recurringExpenseCategories.isEmpty {
                    Section("Düzenli Harcama Grafiği") {
                        RecurringCategoryChart(items: appState.recurringExpenseCategories)
                            .frame(height: 220)
                    }
                }

                if !appState.recurringIncomeCategories.isEmpty {
                    Section("Düzenli Gelir Grafiği") {
                        RecurringCategoryChart(items: appState.recurringIncomeCategories)
                            .frame(height: 220)
                    }
                }

                Section("Düzenli Gelirler") {
                    let recurringIncome = appState.recurringEntries.filter { $0.kind == .income }
                    if recurringIncome.isEmpty {
                        Text("Düzenli gelir eklenmedi.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(recurringIncome) { entry in
                            EntryRow(entry: entry)
                                .entrySwipeActions(entry: entry, editingEntry: $editingEntry)
                        }
                    }
                }

                Section("Düzenli Harcamalar") {
                    let recurringExpenses = appState.recurringEntries.filter { $0.kind == .expense }
                    if recurringExpenses.isEmpty {
                        Text("Düzenli harcama eklenmedi.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(recurringExpenses) { entry in
                            EntryRow(entry: entry)
                                .entrySwipeActions(entry: entry, editingEntry: $editingEntry)
                        }
                    }
                }
            }
            .navigationTitle("Düzenli")
            .sheet(item: $editingEntry) { entry in
                AddEntryView(entry: entry)
            }
        }
    }
}

private struct RecurringCategoryChart: View {
    let items: [CategorySummary]

    var body: some View {
        Chart(items) { item in
            SectorMark(
                angle: .value("Tutar", NSDecimalNumber(decimal: item.total).doubleValue),
                innerRadius: .ratio(0.58),
                angularInset: 1.5
            )
            .foregroundStyle(Color(hex: item.colorHex))
        }
    }
}

private extension View {
    func entrySwipeActions(entry: FinanceEntry, editingEntry: Binding<FinanceEntry?>) -> some View {
        modifier(EntrySwipeActionsModifier(entry: entry, editingEntry: editingEntry))
    }
}

private struct EntrySwipeActionsModifier: ViewModifier {
    @EnvironmentObject private var appState: AppState
    let entry: FinanceEntry
    @Binding var editingEntry: FinanceEntry?

    func body(content: Content) -> some View {
        content
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                Button(role: .destructive) {
                    appState.deleteEntry(entry)
                } label: {
                    Label("Kaldır", systemImage: "trash")
                }

                Button {
                    editingEntry = entry
                } label: {
                    Label("Düzenle", systemImage: "pencil")
                }
                .tint(AppTheme.warning)
            }
    }
}
