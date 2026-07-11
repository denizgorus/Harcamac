import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            Form {
                Section("Görünüm") {
                    Picker("Tema", selection: $appState.themeMode) {
                        ForEach(AppThemeMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Bildirimler") {
                    Toggle("Kedi popup'ları", isOn: $appState.isCatPopupEnabled)
                    Text("Gelir eklenince mutlu, gider eklenince üzgün kedi bildirimi gösterilir.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Veri") {
                    LabeledContent("Hareket sayısı", value: "\(appState.entries.count)")
                    LabeledContent("Varlık sayısı", value: "\(appState.holdings.count)")
                    Text("Kayıtların bu cihazda yerel olarak saklanır ve uygulama açıldığında buradan yüklenir.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Uygulama") {
                    LabeledContent("Sürüm", value: "1.0")
                }
            }
            .navigationTitle("Ayarlar")
        }
    }
}

struct CategoryManagerView: View {
    @EnvironmentObject private var appState: AppState
    @State private var newCategory = ""
    @State private var selectedColor = AppTheme.primary
    @State private var selectedKinds: Set<MoneyFlowKind> = [.expense]
    @State private var selectedCadences: Set<EntryCadence> = [.oneTime]

    var body: some View {
        List {
            Section("Yeni Kategori") {
                TextField("Kategori adı", text: $newCategory)
                    .textInputAutocapitalization(.words)
                    .onChange(of: newCategory) {
                        newCategory = newCategory.filter { !$0.isNumber }
                    }

                ColorPicker("Renk", selection: $selectedColor, supportsOpacity: false)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Kayıt tipi")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    MultiChoiceRow(title: "Gelir", isSelected: selectedKinds.contains(.income)) {
                        toggleKind(.income)
                    }
                    MultiChoiceRow(title: "Gider", isSelected: selectedKinds.contains(.expense)) {
                        toggleKind(.expense)
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Tekrar")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    MultiChoiceRow(title: "Tek seferlik", isSelected: selectedCadences.contains(.oneTime)) {
                        toggleCadence(.oneTime)
                    }
                    MultiChoiceRow(title: "Düzenli", isSelected: selectedCadences.contains(.recurring)) {
                        toggleCadence(.recurring)
                    }
                }

                Button {
                    addCategoryToSelectedGroups()
                } label: {
                    Label("Kategori Ekle", systemImage: "plus.circle.fill")
                }
                .disabled(!canAddCategory)
            }

            ForEach(EntryCadence.allCases) { cadence in
                ForEach(MoneyFlowKind.allCases) { kind in
                    CategoryGroupSection(kind: kind, cadence: cadence)
                }
            }
        }
        .navigationTitle("Kategoriler")
    }

    private var canAddCategory: Bool {
        !newCategory.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !selectedKinds.isEmpty &&
        !selectedCadences.isEmpty
    }

    private func toggleKind(_ kind: MoneyFlowKind) {
        if selectedKinds.contains(kind) {
            selectedKinds.remove(kind)
        } else {
            selectedKinds.insert(kind)
        }
    }

    private func toggleCadence(_ cadence: EntryCadence) {
        if selectedCadences.contains(cadence) {
            selectedCadences.remove(cadence)
        } else {
            selectedCadences.insert(cadence)
        }
    }

    private func addCategoryToSelectedGroups() {
        for kind in selectedKinds {
            for cadence in selectedCadences {
                appState.addCategory(newCategory, colorHex: selectedColor.hexString, kind: kind, cadence: cadence)
            }
        }
        newCategory = ""
    }
}

private struct MultiChoiceRow: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                Spacer()
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? AppTheme.primary : .secondary)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct CategoryGroupSection: View {
    @EnvironmentObject private var appState: AppState
    let kind: MoneyFlowKind
    let cadence: EntryCadence

    var body: some View {
        Section("\(cadence.rawValue) \(kind.rawValue)") {
            let categories = appState.categories(for: kind, cadence: cadence)
            if categories.isEmpty {
                Text("Kategori yok.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(categories) { category in
                    HStack {
                        Circle()
                            .fill(Color(hex: category.colorHex))
                            .frame(width: 14, height: 14)
                        Text(category.name)
                    }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                appState.deleteCategory(category.name, kind: kind, cadence: cadence)
                            } label: {
                                Label("Kaldır", systemImage: "trash")
                            }
                            .tint(AppTheme.expense)
                        }
                }
            }
        }
    }
}
