import SwiftUI

struct AddEntryView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var title = ""
    @State private var category = ""
    @State private var amount = ""
    @State private var kind: MoneyFlowKind = .expense
    @State private var cadence: EntryCadence = .oneTime
    @State private var date = Date()
    @State private var note = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Kayit") {
                    TextField("Baslik", text: $title)
                    TextField("Kategori", text: $category)
                    TextField("Tutar", text: $amount)
                        .keyboardType(.decimalPad)
                    DatePicker("Tarih", selection: $date, displayedComponents: .date)
                }

                Section("Tip") {
                    Picker("Tur", selection: $kind) {
                        ForEach(MoneyFlowKind.allCases) { item in
                            Text(item.rawValue).tag(item)
                        }
                    }

                    Picker("Tekrar", selection: $cadence) {
                        ForEach(EntryCadence.allCases) { item in
                            Text(item.rawValue).tag(item)
                        }
                    }
                }

                Section("Not") {
                    TextField("Opsiyonel", text: $note, axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                }
            }
            .navigationTitle("Yeni Kayit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Vazgec") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Kaydet") {
                        save()
                    }
                    .disabled(!canSave)
                }
            }
        }
    }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !category.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        decimalAmount != nil
    }

    private var decimalAmount: Decimal? {
        Decimal(string: amount.replacingOccurrences(of: ",", with: "."))
    }

    private func save() {
        guard let decimalAmount else { return }

        appState.addEntry(
            FinanceEntry(
                title: title,
                category: category,
                amount: decimalAmount,
                kind: kind,
                cadence: cadence,
                date: date,
                note: note
            )
        )
        dismiss()
    }
}
