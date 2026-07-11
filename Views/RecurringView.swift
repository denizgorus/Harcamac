import SwiftUI

struct RecurringView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            List {
                Section("Duzenli Gelirler") {
                    ForEach(appState.recurringEntries.filter { $0.kind == .income }) { entry in
                        EntryRow(entry: entry)
                    }
                }

                Section("Duzenli Harcamalar") {
                    ForEach(appState.recurringEntries.filter { $0.kind == .expense }) { entry in
                        EntryRow(entry: entry)
                    }
                }
            }
            .navigationTitle("Duzenli")
        }
    }
}
