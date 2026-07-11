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
    @State private var paymentType: PaymentType = .cash
    @State private var date = Date()
    @State private var note = ""
    @State private var installmentCount = 2
    @State private var notificationEnabled = false

    init(entry: FinanceEntry? = nil) {
        editingEntry = entry
        _title = State(initialValue: entry?.title ?? "")
        _category = State(initialValue: entry?.category ?? "")
        _amount = State(initialValue: entry.map { NSDecimalNumber(decimal: $0.amount).stringValue } ?? "")
        _kind = State(initialValue: entry?.kind ?? .expense)
        _cadence = State(initialValue: entry?.cadence ?? .oneTime)
        _paymentType = State(initialValue: (entry?.installmentCount ?? 0) > 1 ? .installment : .cash)
        _date = State(initialValue: entry?.date ?? Date())
        _note = State(initialValue: entry?.note ?? "")
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
                    TextField(amountTitle, text: $amount)
                        .keyboardType(.decimalPad)
                    DatePicker("Tarih", selection: $date, displayedComponents: .date)
                }

                if availableCategories.isEmpty {
                    Section {
                        Text("Bu kayıt tipi için kategori yok. Hareketler ekranındaki kategori düğmesinden ekleyebilirsin.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("İşlem") {
                    Picker("Gelir/Gider", selection: $kind) {
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

                if showsPaymentType {
                    Section("Tür") {
                        Picker("Tür", selection: $paymentType) {
                            ForEach(PaymentType.allCases) { item in
                                Text(item.rawValue).tag(item)
                            }
                        }
                        .pickerStyle(.segmented)

                        if paymentType == .installment {
                            Stepper("Taksit sayısı: \(installmentCount)", value: $installmentCount, in: 2...36)
                        }
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
            .navigationTitle(navigationTitle)
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
                sanitizeInputs()
                normalizePaymentType()
                normalizeCategory()
            }
            .onChange(of: title) {
                title = sanitizedTitle(title)
            }
            .onChange(of: amount) {
                amount = sanitizedAmount(amount)
            }
            .onChange(of: kind) {
                normalizePaymentType()
                normalizeCategory()
            }
            .onChange(of: cadence) {
                normalizePaymentType()
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

    private var showsPaymentType: Bool {
        kind == .expense && cadence == .recurring
    }

    private var amountTitle: String {
        showsPaymentType && paymentType == .installment ? "Taksit tutarı" : "Tutar"
    }

    private var navigationTitle: String {
        if editingEntry != nil { return "Kaydı Düzenle" }
        return kind == .expense ? "Harcama Kayıt" : "Gelir Kayıt"
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
            installmentCount: showsPaymentType && paymentType == .installment ? installmentCount : nil,
            totalAmount: showsPaymentType && paymentType == .installment ? decimalAmount * Decimal(installmentCount) : nil,
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

    private func normalizePaymentType() {
        if !showsPaymentType {
            paymentType = .cash
        }
    }

    private func sanitizeInputs() {
        title = sanitizedTitle(title)
        amount = sanitizedAmount(amount)
    }

    private func sanitizedTitle(_ value: String) -> String {
        value.filter { character in
            !character.isNumber
        }
    }

    private func sanitizedAmount(_ value: String) -> String {
        var result = ""
        var hasSeparator = false

        for character in value {
            if character.isNumber {
                result.append(character)
            } else if character == "," || character == "." {
                guard !hasSeparator else { continue }
                hasSeparator = true
                result.append(",")
            }
        }

        return result
    }
}
