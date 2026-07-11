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
        .overlay(alignment: .topTrailing) {
            if let catPopup = appState.catPopup {
                Text(catPopup)
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(.regularMaterial)
                    .clipShape(Capsule())
                    .shadow(radius: 12)
                    .padding(.top, 58)
                    .padding(.trailing, 16)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.85)) {
                                if appState.catPopup == catPopup {
                                    appState.catPopup = nil
                                }
                            }
                        }
                    }
            }
        }
        .animation(.spring(response: 0.28, dampingFraction: 0.85), value: appState.catPopup)
        .sheet(isPresented: $isAddingEntry) {
            AddEntryView()
        }
    }
}
