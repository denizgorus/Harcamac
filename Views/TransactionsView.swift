import SwiftUI

struct TransactionsView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            List {
                ForEach(appState.entries) { entry in
                    EntryRow(entry: entry)
                }
            }
            .navigationTitle("Hareketler")
        }
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
                Text("\(entry.category) • \(entry.cadence.rawValue)")
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
