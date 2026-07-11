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
