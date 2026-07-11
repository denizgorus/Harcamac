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

                Section("Özet Grafikleri") {
                    ForEach(DashboardChartKind.allCases) { chart in
                        Toggle(chart.rawValue, isOn: chartBinding(chart))
                    }
                }

                Section("Kategoriler") {
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

    private func chartBinding(_ chart: DashboardChartKind) -> Binding<Bool> {
        Binding {
            appState.enabledCharts.contains(chart)
        } set: { isEnabled in
            let contains = appState.enabledCharts.contains(chart)
            guard contains != isEnabled else { return }
            appState.toggleChart(chart)
        }
    }
}

private struct CategoryListView: View {
    @EnvironmentObject private var appState: AppState
    let kind: MoneyFlowKind
    let cadence: EntryCadence

    @State private var newCategory = ""

    var body: some View {
        List {
            Section("Yeni Kategori") {
                HStack {
                    TextField("Kategori adı", text: $newCategory)
                        .textInputAutocapitalization(.words)

                    Button {
                        appState.addCategory(newCategory, kind: kind, cadence: cadence)
                        newCategory = ""
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                    .disabled(newCategory.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }

            Section("Kategoriler") {
                let categories = appState.categories(for: kind, cadence: cadence)
                if categories.isEmpty {
                    Text("Kategori yok.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(categories, id: \.self) { category in
                        Text(category)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    appState.deleteCategory(category, kind: kind, cadence: cadence)
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
