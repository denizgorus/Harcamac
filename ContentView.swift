import SwiftUI
import UIKit

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
                    CatPopupImage(name: catPopup.imageName)

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

private struct CatPopupImage: View {
    let name: String

    var body: some View {
        Group {
            if let image = uiImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "photo")
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 92, height: 92)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var uiImage: UIImage? {
        if let image = UIImage(named: name) {
            return image
        }

        if let url = Bundle.main.url(forResource: name, withExtension: "png"),
           let image = UIImage(contentsOfFile: url.path) {
            return image
        }

        if let url = Bundle.main.url(forResource: name, withExtension: "png", subdirectory: "Resources") {
            return UIImage(contentsOfFile: url.path)
        }

        return nil
    }
}
