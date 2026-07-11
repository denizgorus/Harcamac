import SwiftUI

struct TransactionsView: View {
    @EnvironmentObject private var appState: AppState
    @Binding var isAddingEntry: Bool
    @State private var selectedKind: MoneyFlowKind?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Filtre", selection: $selectedKind) {
                        Text("Tümü").tag(nil as MoneyFlowKind?)
                        ForEach(MoneyFlowKind.allCases) { kind in
                            Text(kind.rawValue).tag(kind as MoneyFlowKind?)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if filteredEntries.isEmpty {
                    ContentUnavailableView(
                        "Hareket yok",
                        systemImage: "list.bullet.rectangle",
                        description: Text("Yeni gelir veya gider eklediğinde burada görünecek.")
                    )
                } else {
                    ForEach(filteredEntries) { entry in
                        EntryRow(entry: entry)
                    }
                }
            }
            .navigationTitle("Hareketler")
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

    private var filteredEntries: [FinanceEntry] {
        guard let selectedKind else { return appState.entries }
        return appState.entries.filter { $0.kind == selectedKind }
    }
}

struct EntryRow: View {
    let entry: FinanceEntry

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: entry.kind == .income ? "arrow.down.left.circle.fill" : "arrow.up.right.circle.fill")
                .foregroundStyle(entry.kind.color)
                .font(.title3)

            VStack(alignment: .leading, spacing: 3) {
                Text(entry.title)
                    .font(.body)
                Text("\(entry.category) - \(entry.cadence.rawValue)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text(entry.amount.currencyText)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(entry.kind.color)
        }
        .padding(.vertical, 4)
    }
}
