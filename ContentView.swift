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
        .overlay {
            if let catPopup = appState.catPopup {
                VStack(spacing: 10) {
                    Image(catPopup.imageName)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 92, height: 92)
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    Text(catPopup.title)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(catPopup == .income ? AppTheme.income : AppTheme.expense)
                }
                .padding(16)
                .background(.regularMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .shadow(radius: 18)
                .transition(.scale(scale: 0.92).combined(with: .opacity))
                .allowsHitTesting(false)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
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
