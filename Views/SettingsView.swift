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
    var body: some View {
        List {
            NavigationLink("Tek seferlik gider kategorileri") {
                CategoryListView(kind: .expense, cadence: .oneTime)
            }

            NavigationLink("Düzenli gider kategorileri") {
                CategoryListView(kind: .expense, cadence: .recurring)
            }

            NavigationLink("Tek seferlik gelir kategorileri") {
                CategoryListView(kind: .income, cadence: .oneTime)
            }

            NavigationLink("Düzenli gelir kategorileri") {
                CategoryListView(kind: .income, cadence: .recurring)
            }
        }
        .navigationTitle("Kategoriler")
    }
}

struct CategoryListView: View {
    @EnvironmentObject private var appState: AppState
    let kind: MoneyFlowKind
    let cadence: EntryCadence

    @State private var newCategory = ""
    @State private var selectedColor = AppTheme.primary

    var body: some View {
        List {
            Section("Yeni Kategori") {
                TextField("Kategori adı", text: $newCategory)
                    .textInputAutocapitalization(.words)

                ColorPicker("Renk", selection: $selectedColor, supportsOpacity: false)

                Button {
                    appState.addCategory(newCategory, colorHex: selectedColor.hexString, kind: kind, cadence: cadence)
                    newCategory = ""
                } label: {
                    Label("Kategori Ekle", systemImage: "plus.circle.fill")
                }
                .disabled(newCategory.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            Section("Kategoriler") {
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
                            }
                    }
                }
            }
        }
        .navigationTitle("\(cadence.rawValue) \(kind.rawValue)")
    }
}
