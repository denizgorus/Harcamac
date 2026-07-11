import SwiftUI

struct RecurringView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            List {
                Section("Düzenli Gelirler") {
                    let recurringIncome = appState.recurringEntries.filter { $0.kind == .income }
                    if recurringIncome.isEmpty {
                        Text("Düzenli gelir eklenmedi.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(recurringIncome) { entry in
                            EntryRow(entry: entry)
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
                        }
                    }
                }
            }
            .navigationTitle("Düzenli")
        }
    }
}
