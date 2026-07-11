import SwiftUI

struct ContentView: View {
    @State private var isAddingEntry = false

    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Ozet", systemImage: "chart.pie.fill")
                }

            TransactionsView()
                .tabItem {
                    Label("Hareketler", systemImage: "list.bullet.rectangle")
                }

            RecurringView()
                .tabItem {
                    Label("Duzenli", systemImage: "calendar.badge.clock")
                }

            AssetsView()
                .tabItem {
                    Label("Varliklar", systemImage: "briefcase.fill")
                }
        }
        .tint(AppTheme.primary)
        .safeAreaInset(edge: .bottom) {
            Button {
                isAddingEntry = true
            } label: {
                Label("Yeni Kayit", systemImage: "plus.circle.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.primary)
            .padding(.horizontal)
            .padding(.bottom, 8)
            .background(.ultraThinMaterial)
        }
        .sheet(isPresented: $isAddingEntry) {
            AddEntryView()
        }
    }
}
