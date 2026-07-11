import SwiftUI

struct TransactionsView: View {
    @EnvironmentObject private var appState: AppState
    @Binding var isAddingEntry: Bool
    @State private var selectedKind: MoneyFlowKind?
    @State private var selectedCategory: String?
    @State private var sortOption: TransactionSortOption = .newest
    @State private var editingEntry: FinanceEntry?
    @State private var isManagingCategories = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Tür", selection: $selectedKind) {
                        Text("Tümü").tag(nil as MoneyFlowKind?)
                        ForEach(MoneyFlowKind.allCases) { kind in
                            Text(kind.rawValue).tag(kind as MoneyFlowKind?)
                        }
                    }
                    .pickerStyle(.segmented)

                    Picker("Kategori", selection: $selectedCategory) {
                        Text("Tüm kategoriler").tag(nil as String?)
                        ForEach(availableCategories, id: \.self) { category in
                            Text(category).tag(category as String?)
                        }
                    }

                    Picker("Sıralama", selection: $sortOption) {
                        ForEach(TransactionSortOption.allCases) { option in
                            Text(option.rawValue).tag(option)
                        }
                    }
                }

                if filteredEntries.isEmpty {
                    ContentUnavailableView(
                        "Hareket yok",
                        systemImage: "list.bullet.rectangle",
                        description: Text("Yeni gelir veya gider eklediğinde burada görünecek.")
                    )
                } else {
                    ForEach(filteredEntries) { entry in
                        EntryRow(entry: entry)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    appState.deleteEntry(entry)
                                } label: {
                                    Label("Kaldır", systemImage: "trash")
                                }

                                Button {
                                    editingEntry = entry
                                } label: {
                                    Label("Düzenle", systemImage: "pencil")
                                }
                                .tint(AppTheme.warning)
                            }
                    }
                }
            }
            .navigationTitle("Hareketler")
            .onChange(of: selectedKind) {
                selectedCategory = nil
            }
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        isManagingCategories = true
                    } label: {
                        Image(systemName: "tag.fill")
                    }
                    .accessibilityLabel("Kategoriler")

                    Button {
                        isAddingEntry = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                    .accessibilityLabel("Yeni kayıt")
                }
            }
            .sheet(item: $editingEntry) { entry in
                AddEntryView(entry: entry)
            }
            .sheet(isPresented: $isManagingCategories) {
                NavigationStack {
                    CategoryManagerView()
                }
            }
        }
    }

    private var filteredEntries: [FinanceEntry] {
        let filtered = appState.entries.filter { entry in
            let kindMatches = selectedKind.map { entry.kind == $0 } ?? true
            let categoryMatches = selectedCategory.map { entry.category == $0 } ?? true
            return kindMatches && categoryMatches
        }

        switch sortOption {
        case .newest:
            return filtered.sorted { $0.date > $1.date }
        case .oldest:
            return filtered.sorted { $0.date < $1.date }
        case .highestAmount:
            return filtered.sorted { $0.amount > $1.amount }
        case .lowestAmount:
            return filtered.sorted { $0.amount < $1.amount }
        }
    }

    private var availableCategories: [String] {
        let categories = appState.entries
            .filter { entry in selectedKind.map { entry.kind == $0 } ?? true }
            .map(\.category)
        return Array(Set(categories)).sorted { $0.localizedCompare($1) == .orderedAscending }
    }
}

private enum TransactionSortOption: String, CaseIterable, Identifiable {
    case newest = "Yeni tarih"
    case oldest = "Eski tarih"
    case highestAmount = "Yüksek tutar"
    case lowestAmount = "Düşük tutar"

    var id: String { rawValue }
}

struct EntryRow: View {
    let entry: FinanceEntry

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: entry.kind == .income ? "arrow.down.left.circle.fill" : "arrow.up.right.circle.fill")
                .foregroundStyle(entry.kind.color)
                .font(.title3)

            VStack(alignment: .leading, spacing: 3) {
                Text(entry.title)
                    .font(.body)
                Text("\(entry.category) - \(entry.cadence.rawValue)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let installmentDescription = entry.installmentDescription {
                    Text(installmentDescription)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Text(entry.amount.currencyText)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(entry.kind.color)
        }
        .padding(.vertical, 4)
    }
}
