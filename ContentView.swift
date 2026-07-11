import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @State private var isAddingEntry = false

    var body: some View {
        TabView {
            DashboardView(isAddingEntry: $isAddingEntry)
                .tabItem {
                    Label("Özet", systemImage: "chart.pie.fill")
                }

            TransactionsView(isAddingEntry: $isAddingEntry)
                .tabItem {
                    Label("Hareketler", systemImage: "list.bullet.rectangle")
                }

            RecurringView()
                .tabItem {
                    Label("Düzenli", systemImage: "calendar.badge.clock")
                }

            AssetsView()
                .tabItem {
                    Label("Varlıklar", systemImage: "briefcase.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Ayarlar", systemImage: "gearshape.fill")
                }
        }
        .tint(AppTheme.primary)
        .preferredColorScheme(appState.preferredColorScheme)
        .sheet(isPresented: $isAddingEntry) {
            AddEntryView()
        }
    }
}
