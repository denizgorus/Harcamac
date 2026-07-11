import SwiftUI

struct AddEntryView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    private let editingEntry: FinanceEntry?
    @State private var title = ""
    @State private var category = ""
    @State private var amount = ""
    @State private var kind: MoneyFlowKind = .expense
    @State private var cadence: EntryCadence = .oneTime
    @State private var date = Date()
    @State private var note = ""
    @State private var hasInstallments = false
    @State private var installmentCount = 2
    @State private var notificationEnabled = false

    init(entry: FinanceEntry? = nil) {
        editingEntry = entry
        _title = State(initialValue: entry?.title ?? "")
        _category = State(initialValue: entry?.category ?? "")
        _amount = State(initialValue: entry.map { NSDecimalNumber(decimal: $0.amount).stringValue } ?? "")
        _kind = State(initialValue: entry?.kind ?? .expense)
        _cadence = State(initialValue: entry?.cadence ?? .oneTime)
        _date = State(initialValue: entry?.date ?? Date())
        _note = State(initialValue: entry?.note ?? "")
        _hasInstallments = State(initialValue: (entry?.installmentCount ?? 0) > 1)
        _installmentCount = State(initialValue: max(entry?.installmentCount ?? 2, 2))
        _notificationEnabled = State(initialValue: entry?.notificationEnabled ?? false)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Kayıt") {
                    TextField("Başlık", text: $title)
                    Picker("Kategori", selection: $category) {
                        ForEach(availableCategories, id: \.self) { category in
                            Text(category).tag(category)
                        }
                    }
                    .disabled(availableCategories.isEmpty)
                    TextField("Tutar", text: $amount)
                        .keyboardType(.decimalPad)
                    DatePicker("Tarih", selection: $date, displayedComponents: .date)
                }

                if availableCategories.isEmpty {
                    Section {
                        Text("Bu kayıt tipi için kategori yok. Ayarlar ekranından kategori ekleyebilirsin.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Tip") {
                    Picker("Tür", selection: $kind) {
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

                Section("Taksit") {
                    Toggle("Taksitli kayıt", isOn: $hasInstallments)

                    if hasInstallments {
                        Stepper("Taksit sayısı: \(installmentCount)", value: $installmentCount, in: 2...36)
                        LabeledContent("Toplam tutar", value: installmentTotalText)
                    }
                }

                if cadence == .recurring {
                    Section("Bildirim") {
                        Toggle("Yaklaşınca bildir", isOn: $notificationEnabled)
                        Text("Her ay seçtiğin güne göre yerel bildirim hazırlanır.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Not") {
                    TextField("Opsiyonel", text: $note, axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                }
            }
            .navigationTitle(editingEntry == nil ? "Yeni Kayıt" : "Kaydı Düzenle")
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
            .onAppear {
                normalizeCategory()
            }
            .onChange(of: kind) {
                normalizeCategory()
            }
            .onChange(of: cadence) {
                normalizeCategory()
            }
        }
    }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !category.isEmpty &&
        decimalAmount != nil
    }

    private var availableCategories: [String] {
        appState.categoryNames(for: kind, cadence: cadence)
    }

    private var decimalAmount: Decimal? {
        Decimal(string: amount.replacingOccurrences(of: ",", with: "."))
    }

    private var installmentTotalText: String {
        guard let decimalAmount else { return "Tutar gir" }
        return (decimalAmount * Decimal(installmentCount)).currencyText
    }

    private func save() {
        guard let decimalAmount else { return }

        let entry = FinanceEntry(
            id: editingEntry?.id ?? UUID(),
            title: title,
            category: category,
            amount: decimalAmount,
            kind: kind,
            cadence: cadence,
            date: date,
            note: note,
            installmentCount: hasInstallments ? installmentCount : nil,
            totalAmount: hasInstallments ? decimalAmount * Decimal(installmentCount) : nil,
            notificationEnabled: cadence == .recurring && notificationEnabled
        )

        if editingEntry == nil {
            appState.addEntry(entry)
        } else {
            appState.updateEntry(entry)
        }
        dismiss()
    }

    private func normalizeCategory() {
        guard !availableCategories.isEmpty else {
            category = ""
            return
        }

        if !availableCategories.contains(category) {
            category = availableCategories[0]
        }
    }
}
