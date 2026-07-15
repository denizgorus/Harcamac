import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Turnstile } from '@marsidev/react-turnstile'
import { AreaChart, Area, BarChart, Bar, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownUp, ArrowLeft, BarChart3, Bitcoin, Bookmark, BookmarkCheck, CalendarDays, ChartNoAxesCombined, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Compass, Eye, EyeOff, HelpCircle, Info, KeyRound, Landmark, LayoutDashboard, ListPlus, LogOut, Menu, Moon, MoreHorizontal, Newspaper, Pencil, PieChart as PieIcon, Plus, Search, Settings, Share2, Sun, Tags, Trash2, TrendingUp, WalletCards, X } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { AssetCatalogItem, FundSnapshot, MarketRange, assetCatalog, fetchAssetHistory, fetchBistPrices, fetchFundSnapshot, fetchHistoricalAssetPrice, marketRangeStart } from './lib/marketPrices'
import { Asset, Cadence, Category, defaultCategories, Entry, FlowKind } from './types'

type Page = 'dashboard' | 'transactions' | 'recurring' | 'assets' | 'settings'
const trMoney = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })
const trMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' })
const today = new Date().toISOString().slice(0, 10)
const MONTHLY_BALANCE_SYMBOL = 'AYLIK-DENGE'

function normalizeSearch(value:string) {
  const replacements:Record<string,string>={ç:'c',ğ:'g',ı:'i',ö:'o',ş:'s',ü:'u'}
  return value.toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g,letter=>replacements[letter]).replace(/[^a-z0-9]+/g,' ').trim()
}

function textSearchScore(value:string,query:string,symbol='') {
  const terms=normalizeSearch(query).split(' ').filter(Boolean)
  if(!terms.length)return 0
  const words=normalizeSearch(`${symbol} ${value}`).split(' ').filter(Boolean)
  const symbolIndex=symbol?0:-1
  const usedWords=new Set<number>()
  let score=0
  for(const term of terms){
    const available=(word:string,index:number)=>!usedWords.has(index)&&word===term
    const exact=words.findIndex(available)
    const symbolPrefix=exact<0&&symbolIndex>=0&&!usedWords.has(symbolIndex)&&words[symbolIndex]?.startsWith(term)?symbolIndex:-1
    const prefix=exact<0&&symbolPrefix<0&&term.length>=3?words.findIndex((word,index)=>!usedWords.has(index)&&word.startsWith(term)):-1
    const partial=exact<0&&symbolPrefix<0&&prefix<0&&term.length>=3?words.findIndex((word,index)=>!usedWords.has(index)&&word.includes(term)):-1
    if(exact<0&&symbolPrefix<0&&prefix<0&&partial<0)return null
    const matched=exact>=0?exact:symbolPrefix>=0?symbolPrefix:prefix>=0?prefix:partial
    usedWords.add(matched)
    score+=exact>=0?exact:symbolPrefix>=0?10:prefix>=0?20+prefix:40+partial
  }
  if(symbol&&normalizeSearch(symbol)===terms.join(''))score-=1000
  return score
}

function assetSearchScore(item:AssetCatalogItem,query:string) {
  return textSearchScore(item.name,query,item.symbol)
}

function currentMonthlyBalance(entries: Entry[]) {
  const now = new Date()
  return entries.filter(entry => {
    const date = new Date(`${entry.entry_date}T12:00:00`)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }).reduce((sum, entry) => sum + (entry.kind === 'income' ? Number(entry.amount) : -Number(entry.amount)), 0)
}

function resolvedAssetValue(asset: Asset, monthlyBalance: number) {
  return asset.symbol === MONTHLY_BALANCE_SYMBOL ? monthlyBalance : Number(asset.units) * Number(asset.current_price)
}
const nav = [
  { id: 'dashboard' as Page, label: 'Özet', icon: LayoutDashboard }, { id: 'transactions' as Page, label: 'Hareketler', icon: ArrowDownUp },
  { id: 'recurring' as Page, label: 'Düzenli', icon: CalendarDays }, { id: 'assets' as Page, label: 'Varlıklar', icon: WalletCards },
  { id: 'settings' as Page, label: 'Ayarlar', icon: Settings }
]
const guideSteps = [
  { title: 'Yeni hareket ekleme', text: 'Gelir veya gider kaydı eklemek için sağ üstteki “Yeni hareket” düğmesini kullanın.', spot: 'top-action' },
  { title: 'Hareketleri bulma', text: 'Hareketler sayfasında arama, tür, kategori ve sıralama filtreleriyle kayıtları hızlıca daraltabilirsiniz.', spot: 'filters' },
  { title: 'Kategorileri yönetme', text: 'Hareketler sayfasındaki etiket simgesiyle kategorileri açıp yeni kategori ve renk ekleyebilirsiniz.', spot: 'category-action' },
  { title: 'Kategorileri düzenleme', text: 'Telefonda kategori satırını sola kaydırarak Düzenle ve Sil işlemlerini açın. Bilgisayarda aynı işlemler satırın sağındadır.', spot: 'category-list' },
  { title: 'Grafikleri inceleme', text: 'Özet ekranındaki sabit grafiklerden aylık akışı ve kategori dağılımını görebilirsiniz. Pasta grafiğinin altında tüm kategoriler tutar ve yüzdeleriyle sıralanır.', spot: 'charts' },
  { title: 'Sayfalar arasında gezinme', text: 'PC’de soldaki menü, telefonda alttaki sekmeler ile Özet, Hareketler, Düzenli ve Ayarlar arasında geçiş yapılır.', spot: 'navigation' },
  { title: 'Ayarlar', text: 'Tema, kedi bildirimi, kategori yönetimi ve bu rehbere tekrar ulaşma seçenekleri Ayarlar sayfasındadır.', spot: 'settings' }
]
type ChartKind = 'bar' | 'pie' | 'area'
type ChartMetric = 'both' | 'income' | 'expense' | 'categoryExpense'
type ChartRange = 'month' | 'week' | 'all'
type ChartWidget = { id:string; title:string; chart:ChartKind; metric:ChartMetric; range:ChartRange }
const defaultWidgets: ChartWidget[] = [
  { id:'expense-pie', title:'Gider dağılımı', chart:'pie', metric:'categoryExpense', range:'month' },
  { id:'flow', title:'Gelir ve gider akışı', chart:'bar', metric:'both', range:'all' }
]
const authHeadlines = [
  'Paranızın nereye gittiğini bilin.',
  'Her liranın hikayesini tek ekranda görün.',
  'Bugünün harcamaları yarının planına dönüşsün.',
  'Bütçeniz netleşsin, kararlarınız kolaylaşsın.',
  'Gelirinizi yönetin, hedeflerinize yaklaşın.',
  'Küçük kayıtlarla büyük resmi görün.',
  'Finansal düzeniniz bir dokunuşla başlasın.',
  'Harcamalarınızı izleyin, kontrolü elinizde tutun.',
  'Rakamlarınız konuşsun, siz geleceği planlayın.',
  'Birikimlerinize giden yolu görünür kılın.',
  'Paranızı takip edin, hayatınızı sadeleştirin.',
  'Bütçenizi anlayın, geleceğinizi güvenle kurun.',
  'Geliriniz ve gideriniz aynı hikayede buluşsun.',
  'Harcamalar görünür olsun, hedefler yakınlaşsın.',
  'Planlı bir bütçe, daha sakin bir zihin demektir.',
  'Paranızı değil, önceliklerinizi yönetin.',
  'Her kayıt, daha güçlü bir finansal alışkanlık olsun.',
  'Ay sonunu beklemeden bütçenizi görün.',
  'Finansal kararlarınız tahmine değil veriye dayansın.',
  'Kazandığınızı bilin, harcadığınızı anlayın.',
  'Bütçenizin ritmini yakalayın.',
  'Gereksiz harcamaları fark edin, önemli hedeflere yer açın.',
  'Paranızı izlemek, geleceğinizi şekillendirmektir.',
  'Gelir ve gider dengeniz hep gözünüzün önünde olsun.',
  'Finansal hedeflerinizi günlük alışkanlıklara dönüştürün.',
  'Bütçenize bakınca ne olduğunu hemen anlayın.',
  'Her ayı daha bilinçli tamamlayın.',
  'Harcamalarınız da planlarınız kadar düzenli olsun.',
  'Paranız için net, sade ve güçlü bir başlangıç.',
  'Bütçenizi karmaşadan çıkarın.',
  'Birikim hedefiniz her gün biraz daha yaklaşsın.',
  'Finansal görünümünüz tek bakışta netleşsin.',
  'Harcadığınız her tutar doğru kategoriye yerleşsin.',
  'Düzenli takip, rahat kararlar getirsin.',
  'Paranızı yönetmek gününüzü zorlaştırmasın.',
  'Ayın hesabını ay sonunda değil, bugün görün.',
  'Gelir akışınızı tanıyın, harcama alışkanlıklarınızı geliştirin.',
  'Bütçenizde sürprizlere daha az yer bırakın.',
  'Finansal kontrol, küçük bir kayıtla başlar.',
  'Her hareketinizi anlamlı bir bütçeye dönüştürün.',
  'Paranızı nereye ayırdığınızı güvenle görün.',
  'Bütçeniz hedeflerinize göre şekillensin.',
  'Harcama alışkanlıklarınızı rakamlarla keşfedin.',
  'Daha az belirsizlik, daha çok finansal güven.',
  'Gelirinize yön verin, giderlerinize sınır koyun.',
  'Bütçenizi takip etmek zahmet değil alışkanlık olsun.',
  'Aylık dengenizi her gün yanınızda taşıyın.',
  'Paranızı sade bir düzende yönetin.',
  'Bugünü kaydedin, yarını daha iyi planlayın.',
  'Her kategori finansal hikayenizin bir parçası olsun.',
  'Finansal ilerlemenizi adım adım görün.',
  'Bütçenizde kontrolü yeniden kazanın.',
  'Harcamalarınızı anlayınca hedefleriniz netleşir.',
  'Geliriniz değişse de kontrol sizde kalsın.',
  'Paranızı planlayın, kararlarınızı rahatlatın.',
  'Finansal hedeflerinizi görünür tutun.',
  'Küçük harcamaları kaçırmadan büyük resmi koruyun.',
  'Bütçenizde neyin önemli olduğuna siz karar verin.',
  'Her ay için daha net bir başlangıç yapın.',
  'Gelir ve giderlerinizi tek bir düzende buluşturun.',
  'Finansal alışkanlıklarınızı sessizce güçlendirin.',
  'Paranızla ilgili soruların cevabı elinizin altında olsun.',
  'Bütçenizi takip edin, kendinize daha çok alan açın.',
  'Harcamalarınızı azaltmadan önce onları anlayın.',
  'Birikim yolculuğunuzu rakamlarla görün.',
  'Finansal düzen, günlük hayatınıza uyum sağlasın.',
  'Ay boyunca bütçenizden kopmayın.',
  'Her işlem daha bilinçli bir karara dönüşsün.',
  'Kazancınızı koruyun, hedeflerinizi besleyin.',
  'Bütçeniz size yük değil yol gösterici olsun.',
  'Rakamlar sadeleşsin, planlar güçlensin.',
  'Paranızın kontrolü her zaman sizde olsun.',
  'Bugünün dengesi yarının özgürlüğünü kursun.',
  'Finansal yolculuğunuzu tek bakışta izleyin.',
  'Her ay bütçenizi biraz daha iyi tanıyın.',
  'Gelirinizin gücünü doğru planla artırın.',
  'Harcamalarınızı kaydedin, ilerlemenizi görün.',
  'Finansal huzur net bir bütçeyle başlasın.'
]
const authDescription = 'Gelirlerinizi, harcamalarınızı ve varlıklarınızı sade bir ekranda takip edin.'

function authMessage(error: { code?: string; message?: string } | null) {
  if (!error) return ''
  if (error.code === 'invalid_credentials' || error.message?.toLowerCase().includes('invalid login credentials')) return 'E-posta adresi veya şifre eşleşmiyor.'
  if (error.code === 'email_not_confirmed') return 'E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu kontrol edin.'
  if (error.code === 'validation_failed') return 'E-posta adresini ve şifreyi kontrol edin.'
  return error.message || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [splashDone, setSplashDone] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light')
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, value) => setSession(value))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme) }, [theme])
  useEffect(() => { const timer = window.setTimeout(() => setSplashDone(true), 1250); return () => window.clearTimeout(timer) }, [])
  if (!authReady || !splashDone) return <AppSplash />
  if (!session) return <Auth theme={theme} setTheme={setTheme} />
  return <FinanceApp session={session} theme={theme} setTheme={setTheme} />
}

function AppSplash() { return <div className="app-splash"><div className="splash-orbit"><span className="brand-mark turkish-lira-symbol">₺</span></div><b>Harcamaç</b><small>Finansal görünümün hazırlanıyor</small></div> }

function TypingText({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState('')
  useEffect(() => {
    let index = 0
    let typingTimer: number | undefined
    const startTimer = window.setTimeout(() => {
      typingTimer = window.setInterval(() => {
        index += 1
        setVisibleText(text.slice(0, index))
        if (index >= text.length && typingTimer) window.clearInterval(typingTimer)
      }, 70)
    }, 450)
    return () => { window.clearTimeout(startTimer); if (typingTimer) window.clearInterval(typingTimer) }
  }, [text])
  return <span className="typing-text" aria-label={text}>{visibleText}<i aria-hidden="true" /></span>
}

function Auth({theme,setTheme}:{theme:'light'|'dark';setTheme:(theme:'light'|'dark')=>void}) {
  const [headline] = useState(() => authHeadlines[Math.floor(Math.random() * authHeadlines.length)])
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [busy, setBusy] = useState(false)
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
  const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString()

  async function socialLogin() {
    setBusy(true); setMessage('')
    if (!isSupabaseConfigured) { setMessage('Localhost girişi için web/.env dosyasına VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ekleyin.'); setBusy(false); return }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) { setMessage(error.message); setBusy(false) }
  }

  async function resetPassword() {
    setBusy(true); setMessage('')
    if (!isSupabaseConfigured) { setMessage('Şifre sıfırlama için önce Supabase bağlantısını web/.env dosyasında yapılandırın.'); setBusy(false); return }
    if (!email) { setMessage('Şifre sıfırlama bağlantısı için e-posta adresinizi yazın.'); setBusy(false); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setMessage(error?.message || 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.')
    setBusy(false)
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    if (!isSupabaseConfigured) { setMessage('Supabase bağlantısı henüz yapılandırılmadı. .env dosyasını kontrol edin.'); setBusy(false); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage('E-posta adresi geçerli değil.'); setBusy(false); return }
    if (mode === 'signup' && password !== passwordAgain) { setMessage('Şifreler birbiriyle eşleşmiyor.'); setBusy(false); return }
    if (turnstileSiteKey && !captchaToken) { setMessage('Lütfen robot olmadığınızı doğrulayın.'); setBusy(false); return }
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captchaToken || undefined } })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: redirectTo, captchaToken: captchaToken || undefined } })
    setMessage(authMessage(result.error) || (mode === 'signup' ? 'Doğrulama bağlantısı e-posta adresinize gönderildi. Gelen kutunuzu kontrol edin.' : ''))
    setBusy(false)
  }
  return <main className={`auth-shell ${mode === 'login' ? 'auth-login' : 'auth-signup'}`}>
    <button type="button" className="auth-theme-toggle" title={theme==='dark'?'Açık temaya geç':'Koyu temaya geç'} aria-label={theme==='dark'?'Açık temaya geç':'Koyu temaya geç'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun/>:<Moon/>}</button>
    <section className="auth-story"><div className="auth-brand"><span className="brand-mark turkish-lira-symbol">₺</span> Harcamaç</div><div className="auth-mobile-story"><h1><TypingText text={headline} /></h1><p>{authDescription}</p></div><div className="auth-story-copy"><h1><TypingText text={headline} /></h1></div><small className="auth-description-footer">{authDescription}</small></section>
    <section className="auth-panel"><form className="auth-form" onSubmit={submit}>
      <div><h2>{mode === 'login' ? 'Tekrar hoş geldiniz' : 'Hesabınızı oluşturun'}</h2><p>{mode === 'login' ? 'Devam etmek için giriş yapın.' : 'Finans takibinize birkaç saniyede başlayın.'}</p></div>
      {!isSupabaseConfigured && <div className="form-message">Localhost girişi için Supabase bilgileri eksik. `web/.env` dosyasına `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` ekleyip dev server’ı yeniden başlatın.</div>}
      {mode === 'signup' && <label>Ad soyad<input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>}
      <label>E-posta<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      <label>Şifre<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
      {mode === 'signup' && <label>Şifreyi doğrula<input required minLength={8} type="password" value={passwordAgain} onChange={e => setPasswordAgain(e.target.value)} autoComplete="new-password" /></label>}
      {turnstileSiteKey && <div className="turnstile-wrap"><Turnstile siteKey={turnstileSiteKey} options={{ language: 'tr', theme }} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken('')} onError={() => setCaptchaToken('')} /></div>}
	      {message && <div className="form-message">{message}</div>}
	      <button className="primary wide" disabled={busy}>{busy ? 'Bekleyin…' : mode === 'login' ? 'Giriş yap' : 'Üye ol'}</button>
	      {mode === 'login' && <button type="button" className="text-button small-link" onClick={resetPassword} disabled={busy}>Şifremi unuttum</button>}
	      <div className="auth-divider"><span>veya</span></div>
      <div className="social-buttons"><button type="button" onClick={socialLogin} disabled={busy}><span className="google-mark">G</span>Google ile devam et</button></div>
      <button type="button" className="text-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setPasswordAgain(''); setCaptchaToken(''); setMessage('') }}>{mode === 'login' ? 'Hesabınız yok mu? Üye olun' : 'Zaten hesabınız var mı? Giriş yapın'}</button>
    </form></section>
  </main>
}

function FinanceApp({ session, theme, setTheme }: { session: Session; theme:'light'|'dark'; setTheme:(theme:'light'|'dark')=>void }) {
  const [page, setPage] = useState<Page>('dashboard')
  const [entries, setEntries] = useState<Entry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [entryOpen, setEntryOpen] = useState(false)
  const [assetOpen, setAssetOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [catAlerts, setCatAlerts] = useState(() => localStorage.getItem('catAlerts') !== 'false')
  const [toast, setToast] = useState<{kind:FlowKind;text:string}|null>(null)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const assetsRef = useRef<Asset[]>([])
  const userId = session.user.id

  async function loadData() {
    setLoading(true)
    const [e, c, a] = await Promise.all([
      supabase.from('entries').select('*, categories(name,color)').order('entry_date', { ascending: false }),
      supabase.from('categories').select('*').order('name'), supabase.from('assets').select('*').order('created_at', { ascending: false })
    ])
    setEntries((e.data || []).map((x: any) => ({ ...x, category_name: x.categories?.name || 'Diğer', category_color: x.categories?.color || '#7b837e' })))
    let loadedCategories = (c.data || []) as Category[]
    const defaultsSeeded = session.user.user_metadata.default_categories_seeded_v1 === true
    if (!c.error && !defaultsSeeded) {
      const existingKeys = new Set(loadedCategories.map(category => `${category.kind}:${category.name.toLocaleLowerCase('tr')}`))
      const missingDefaults = defaultCategories.filter(category => !existingKeys.has(`${category.kind}:${category.name.toLocaleLowerCase('tr')}`))
      if (missingDefaults.length) {
        const { data: seeded, error: seedError } = await supabase.from('categories').insert(missingDefaults.map(category => ({ ...category, user_id: userId }))).select('*').order('name')
        if (!seedError) {
          loadedCategories = [...loadedCategories, ...((seeded || []) as Category[])].sort((left, right) => left.name.localeCompare(right.name, 'tr'))
          if (loadedCategories.length === missingDefaults.length) setSetupOpen(true)
        }
      }
      const defaultUpdates = defaultCategories.flatMap(category => {
        const existing = loadedCategories.find(item => item.kind === category.kind && item.name.localeCompare(category.name, 'tr', { sensitivity: 'base' }) === 0)
        if (!existing || (existing.one_time === category.one_time && existing.recurring === category.recurring)) return []
        return [supabase.from('categories').update({ one_time: existing.one_time || category.one_time, recurring: existing.recurring || category.recurring }).eq('id', existing.id).select('*').single()]
      })
      if (defaultUpdates.length) {
        const updated = await Promise.all(defaultUpdates)
        const replacements = new Map(updated.flatMap(result => result.data ? [[result.data.id, result.data as Category] as const] : []))
        loadedCategories = loadedCategories.map(category => replacements.get(category.id) || category)
      }
      await supabase.auth.updateUser({ data: { ...session.user.user_metadata, default_categories_seeded_v1: true } })
    }
    setCategories(loadedCategories); setAssets((a.data || []) as Asset[]); setLoading(false)
  }
  useEffect(() => { loadData() }, [userId])
  useEffect(() => { assetsRef.current = assets }, [assets])
  useEffect(() => {
    const channel = supabase.channel(`assets-${userId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'assets', filter: `user_id=eq.${userId}`
    }, payload => {
      if (payload.eventType === 'DELETE') {
        const deleted = payload.old as Pick<Asset, 'id'>
        setAssets(items => items.filter(asset => asset.id !== deleted.id))
        return
      }
      const changed = payload.new as Asset
      setAssets(items => items.some(asset => asset.id === changed.id)
        ? items.map(asset => asset.id === changed.id ? changed : asset)
        : [changed, ...items])
    }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId])
  useEffect(() => { localStorage.setItem('catAlerts', String(catAlerts)) }, [catAlerts])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2200); return () => window.clearTimeout(timer) }, [toast])

  function entrySaved(kind: FlowKind) {
    setEntryOpen(false); loadData()
    if (catAlerts) setToast({ kind, text: kind === 'income' ? 'Gelir eklendi' : 'Gider eklendi' })
  }

  async function refreshBistPrices(sourceAssets = assets) {
    const candidates = sourceAssets.filter(asset => (asset.kind === 'Hisse' || asset.kind === 'Fon') && asset.symbol.trim())
    if (!candidates.length) return
    try {
      const quotes = await fetchBistPrices(candidates)
      if (!quotes.length) return
      await Promise.all(quotes.map(quote => supabase.from('assets').update({ current_price: quote.price }).eq('id', quote.id)))
      setAssets(items => items.map(asset => {
        const quote = quotes.find(item => item.id === asset.id)
        return quote ? { ...asset, current_price: quote.price } : asset
      }))
    } catch (error) {
      console.error('Piyasa fiyatları alınamadı.', error)
    }
  }

  useEffect(() => {
    if (page !== 'assets' || loading) return
    let cancelled = false
    let running = false
    let timer: number | undefined
    async function runRefresh() {
      if (cancelled || running || document.visibilityState !== 'visible') return
      running = true
      try { await refreshBistPrices(assetsRef.current) } finally { running = false }
    }
    async function refreshLoop() {
      await runRefresh()
      if (!cancelled) timer = window.setTimeout(refreshLoop, 15000)
    }
    function refreshWhenVisible() { if (document.visibilityState === 'visible') void runRefresh() }
    void refreshLoop()
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [page, loading])

  const title = nav.find(x => x.id === page)?.label
  const subtitle = page === 'dashboard' ? 'Finansal durumunuza genel bakış' : page === 'transactions' ? 'Tüm gelir ve gider kayıtlarınız' : page === 'assets' ? 'Portföyünüz ve varlık dağılımınız' : ''
  const topAction = page === 'assets'
    ? { label: 'Varlık ekle', onClick: () => setAssetOpen(true) }
    : { label: 'Yeni hareket', onClick: () => { setEditEntry(null); setEntryOpen(true) } }
  return <div className="app-shell sidebar-auto">
    <aside className="sidebar"><div className="logo"><span className="brand-mark turkish-lira-symbol">₺</span><span>Harcamaç</span></div><nav data-tour="navigation">{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon /> <span>{item.label}</span></button>)}</nav><div className="sidebar-user"><div className="avatar">{(session.user.user_metadata.full_name || session.user.email || 'H')[0].toUpperCase()}</div><div><b>{session.user.user_metadata.full_name || 'Hesabım'}</b><small>{session.user.email}</small></div><button title="Çıkış yap" onClick={() => supabase.auth.signOut()}><LogOut /></button></div></aside>
    <main className="workspace"><header><div><span className="mobile-logo">Harcamaç</span><h1>{title}</h1><p>{subtitle}</p></div><div className="header-actions">{(page === 'transactions' || page === 'dashboard') && <button className="category-button" data-tour="category-action" title="Kategoriler" onClick={() => setCategoryOpen(true)}><Tags /><span>Kategoriler</span></button>}<button className="primary" data-tour="top-action" onClick={topAction.onClick}><Plus /> <span>{topAction.label}</span></button></div></header>
      {loading ? <div className="loading">Verileriniz getiriliyor…</div> : <>
        {page === 'dashboard' && <Dashboard entries={entries} assets={assets} />}
        {page === 'transactions' && <Transactions entries={entries} categories={categories} onEdit={e => { setEditEntry(e); setEntryOpen(true) }} onDelete={async id => { await supabase.from('entries').delete().eq('id', id); loadData() }} />}
        {page === 'recurring' && <Recurring entries={entries} onEdit={e => { setEditEntry(e); setEntryOpen(true) }} />}
        {page === 'assets' && <Assets assets={assets} entries={entries} onDelete={async id => { await supabase.from('assets').delete().eq('id', id); loadData() }} onChanged={loadData} />}
        {page === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} email={session.user.email || ''} catAlerts={catAlerts} setCatAlerts={setCatAlerts} openCategories={() => setCategoryOpen(true)} openGuide={() => setGuideOpen(true)} />}
      </>}
    </main>
    <nav className="bottom-nav" data-tour="navigation">{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon/><span>{item.label}</span></button>)}</nav>
    {entryOpen && <EntryModal userId={userId} categories={categories} entry={editEntry} close={() => setEntryOpen(false)} saved={entrySaved} onCategoryAdded={category => setCategories(items => [...items, category].sort((left, right) => left.name.localeCompare(right.name, 'tr')))} />}
    {assetOpen && <AssetModal userId={userId} assets={assets} close={() => setAssetOpen(false)} saved={() => { setAssetOpen(false); loadData() }} assetsChanged={loadData} />}
    {categoryOpen && <CategoryModal userId={userId} categories={categories} close={() => setCategoryOpen(false)} reload={loadData} />}
    {setupOpen && <SetupModal userId={userId} close={() => setSetupOpen(false)} saved={() => { setSetupOpen(false); loadData() }} />}
    {guideOpen && <GuideModal goTo={setPage} showCategories={() => setCategoryOpen(true)} hideCategories={() => setCategoryOpen(false)} close={() => { setGuideOpen(false); setCategoryOpen(false) }} />}
    {toast && <CatToast kind={toast.kind} text={toast.text}/>}
  </div>
}

function Dashboard({ entries, assets }: { entries: Entry[]; assets: Asset[] }) {
  const now = new Date(), current = entries.filter(e => { const d = new Date(e.entry_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const income = current.filter(e => e.kind === 'income').reduce((s,e) => s + Number(e.amount), 0)
  const expense = current.filter(e => e.kind === 'expense').reduce((s,e) => s + Number(e.amount), 0)
  const monthlyBalance = income - expense
  const assetTotal = assets.reduce((sum, asset) => sum + resolvedAssetValue(asset, monthlyBalance), 0)
  return <div className="page-content">
    <section className="metric-grid"><Metric label="Bu ay gelir" value={income} tone="green"/><Metric label="Bu ay gider" value={expense} tone="red"/><Metric label="Aylık denge" value={income-expense} tone="ink"/><Metric label="Toplam varlık" value={assetTotal} tone="blue"/></section>
    <section className="chart-grid">{defaultWidgets.map(widget=><article className="panel chart-card" data-tour={widget.id==='flow'?'charts':undefined} key={widget.id}><ChartHeader widget={widget}/><ChartBody widget={widget} entries={entries}/></article>)}
    </section>
    <section className="panel recent"><PanelTitle title="Son hareketler" subtitle="En yeni kayıtlar"/><EntryRows entries={entries.slice(0,5)}/></section>
  </div>
}
function Metric({label,value,tone}:{label:string;value:number;tone:string}) { return <article className={`metric ${tone}`}><small>{label}</small><b>{trMoney.format(value)}</b><span>{tone==='red'?'Aylık harcama':tone==='green'?'Aylık kazanç':'Güncel toplam'}</span></article> }
function PanelTitle({title,subtitle,icon}:{title:string;subtitle:string;icon?:React.ReactNode}) { return <div className="panel-title"><div>{icon}<span><b>{title}</b><small>{subtitle}</small></span></div><button className="icon-button subtle"><Menu/></button></div> }

function ChartHeader({widget}:{widget:ChartWidget}) { return <div className="panel-title chart-toolbar"><div>{widget.chart==='pie'?<PieIcon/>:<BarChart3/>}<span><b>{widget.title}</b><small>{rangeLabel(widget.range)} · {metricLabel(widget.metric)}</small></span></div></div> }
function rangeLabel(range:ChartRange){return range==='month'?'Bu ay':range==='week'?'Bu hafta':'Tüm zamanlar'}
function metricLabel(metric:ChartMetric){return metric==='income'?'Gelir':metric==='expense'?'Gider':metric==='categoryExpense'?'Kategoriye göre gider':'Gelir ve gider'}
function filterRange(entries:Entry[],range:ChartRange){const now=new Date();return entries.filter(e=>{const d=new Date(`${e.entry_date}T12:00:00`);if(range==='all')return true;if(range==='month')return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();const start=new Date(now);start.setDate(now.getDate()-6);return d>=start&&d<=now})}
function chartData(widget:ChartWidget,entries:Entry[]){const list=filterRange(entries,widget.range);if(widget.metric==='categoryExpense')return Object.values(list.filter(e=>e.kind==='expense').reduce((a,e)=>{const key=e.category_name||'Diğer';a[key]||={name:key,value:0,color:e.category_color||'#7b837e'};a[key].value+=Number(e.amount);return a},{} as Record<string,{name:string;value:number;color:string}>)).sort((a,b)=>b.value-a.value);if(widget.range==='all'){return Array.from({length:6},(_,i)=>{const d=new Date(new Date().getFullYear(),new Date().getMonth()-5+i,1);const month=list.filter(e=>{const x=new Date(`${e.entry_date}T12:00:00`);return x.getMonth()===d.getMonth()&&x.getFullYear()===d.getFullYear()});return {name:d.toLocaleDateString('tr-TR',{month:'short'}),Gelir:month.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.amount),0),Gider:month.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.amount),0)}})}return Object.values(list.reduce((a,e)=>{const key=new Date(`${e.entry_date}T12:00:00`).toLocaleDateString('tr-TR',{day:'numeric',month:'short'});a[key]||={name:key,Gelir:0,Gider:0};a[key][e.kind==='income'?'Gelir':'Gider']+=Number(e.amount);return a},{} as Record<string,{name:string;Gelir:number;Gider:number}>))}
function ChartBody({widget,entries}:{widget:ChartWidget;entries:Entry[]}) {
  const data=chartData(widget,entries), colors=['#dc5b4f','#e7a23d','#418a73','#477ea8','#8b69a8','#6b7c55']
  const total=data.reduce((sum:any,item:any)=>sum+Number(item.value||0),0)
  if(widget.chart==='pie'||widget.metric==='categoryExpense')return <div className="donut-wrap"><div className="donut-stage"><div className="donut"><ResponsiveContainer><PieChart><Pie data={data.length?data:[{name:'Veri yok',value:1}]} innerRadius="55%" outerRadius="90%" dataKey="value" stroke="none" isAnimationActive={false}>{(data.length?data:[{}]).map((item:any,index)=><Cell key={index} fill={data.length?(item.color||colors[index%colors.length]):'#e4e6e1'}/>)}</Pie></PieChart></ResponsiveContainer><div><b>{trMoney.format(total)}</b><small>toplam</small></div></div></div><div className="legend">{data.map((item:any,index)=><div key={item.name}><span className="legend-dot" style={{background:item.color||colors[index%colors.length]}}/><span className="legend-name">{item.name}</span><span className="legend-amount">{trMoney.format(item.value)}</span><b>{total?Math.round(item.value/total*100):0}%</b></div>)}</div></div>
  return <div className="chart"><ResponsiveContainer>{widget.chart==='area'?<AreaChart data={data}><CartesianGrid vertical={false} stroke="#dfe2dc"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={(v:number)=>trMoney.format(v)}/>{widget.metric!=='expense'&&<Area dataKey="Gelir" fill="#3d8b68" stroke="#3d8b68" fillOpacity={.18}/>} {widget.metric!=='income'&&<Area dataKey="Gider" fill="#dc5b4f" stroke="#dc5b4f" fillOpacity={.16}/>}</AreaChart>:<BarChart data={data}><CartesianGrid vertical={false} stroke="#dfe2dc"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={(v:number)=>trMoney.format(v)}/>{widget.metric!=='expense'&&<Bar dataKey="Gelir" fill="#3d8b68" radius={[4,4,0,0]}/>} {widget.metric!=='income'&&<Bar dataKey="Gider" fill="#dc5b4f" radius={[4,4,0,0]}/>}</BarChart>}</ResponsiveContainer></div>
}
function Transactions({ entries, categories, onEdit, onDelete }: { entries:Entry[];categories:Category[];onEdit:(e:Entry)=>void;onDelete:(id:string)=>void }) {
  const [query,setQuery]=useState(''), [kind,setKind]=useState<'all'|FlowKind>('all'), [cat,setCat]=useState('all'), [sort,setSort]=useState<'date_desc'|'date_asc'|'amount_desc'|'amount_asc'>('date_desc')
  const filtered=useMemo(()=>entries.filter(e=>(kind==='all'||e.kind===kind)&&(cat==='all'||e.category_id===cat)&&textSearchScore(`${e.title} ${e.category_name||''}`,query)!==null).sort((a,b)=>sort==='amount_desc'?Number(b.amount)-Number(a.amount):sort==='amount_asc'?Number(a.amount)-Number(b.amount):sort==='date_asc'?a.entry_date.localeCompare(b.entry_date):b.entry_date.localeCompare(a.entry_date)),[entries,query,kind,cat,sort])
  const groups=Object.entries(filtered.reduce((a,e)=>{const key=trMonth.format(new Date(`${e.entry_date}T12:00:00`));(a[key]||=[]).push(e);return a},{} as Record<string,Entry[]>))
  return <div className="page-content transactions-page"><div className="filters" data-tour="filters"><label className="search"><Search/><input placeholder="Hareket ara" value={query} onChange={e=>setQuery(e.target.value)}/></label><select value={kind} onChange={e=>setKind(e.target.value as any)}><option value="all">Tüm türler</option><option value="expense">Giderler</option><option value="income">Gelirler</option></select><select value={cat} onChange={e=>setCat(e.target.value)}><option value="all">Tüm kategoriler</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value as any)}><option value="date_desc">Tarih: yeniden eskiye</option><option value="date_asc">Tarih: eskiden yeniye</option><option value="amount_desc">Tutar: yüksekten düşüğe</option><option value="amount_asc">Tutar: düşükten yükseğe</option></select></div>
    {groups.length?groups.map(([month,list])=><section className="transaction-group" key={month}><div className="month-title"><b>{month}</b><span>{list.length} hareket</span></div><div className="panel"><EntryRows entries={list} actions={{onEdit,onDelete}}/></div></section>):<Empty text="Henüz hareket bulunmuyor."/>}</div>
}
function EntryRows({entries,actions}:{entries:Entry[];actions?:{onEdit:(e:Entry)=>void;onDelete:(id:string)=>void}}){return <div className="entry-list">{entries.map(e=><div className="entry-swipe" key={e.id}><div className="entry-row"><div className={`entry-icon ${e.kind}`}><CircleDollarSign/></div><div className="entry-main"><b>{e.title}</b><span>{e.category_name} · {new Date(`${e.entry_date}T12:00:00`).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})} · {e.cadence==='recurring'?'Düzenli':'Tek seferlik'}</span></div><div className="entry-side"><div className={`entry-amount ${e.kind}`}><b>{e.kind==='expense'?'-':'+'}{trMoney.format(Number(e.amount))}</b></div></div></div>{actions&&<div className="swipe-actions"><button title="Düzenle" onClick={()=>actions.onEdit(e)}><Pencil/><span>Düzenle</span></button><button className="danger" title="Sil" onClick={()=>confirm('Bu hareket silinsin mi?')&&actions.onDelete(e.id)}><Trash2/><span>Sil</span></button></div>}</div>)}</div>}

function Recurring({entries,onEdit}:{entries:Entry[];onEdit:(e:Entry)=>void}) { const list=entries.filter(e=>e.cadence==='recurring'); const inc=list.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.amount),0), exp=list.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.amount),0); return <div className="page-content"><section className="metric-grid two"><Metric label="Düzenli gelir" value={inc} tone="green"/><Metric label="Düzenli gider" value={exp} tone="red"/></section><section className="panel"><PanelTitle title="Düzenli hareketler" subtitle="Aylık planınız"/><EntryRows entries={list} actions={{onEdit,onDelete:()=>{}}}/></section></div> }

const assetRanges: MarketRange[] = ['1G','1H','1A','6A','1Y','5Y','Maks.']
const assetCategoryColors: Record<string,string> = {
  Hisse: '#32785b',
  Fon: '#477ca0',
  'Kıymetli Madenler': '#c89436',
  Kripto: '#8b66b2',
  Para: '#c94d43',
  Endeks: '#66735f',
  Diğer: '#7b837e'
}

function historyLabel(timestamp:number,range:MarketRange) {
  const date=new Date(timestamp*1000)
  if(range==='1G')return date.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})
  if(range==='1H')return `${date.toLocaleDateString('tr-TR',{weekday:'short'})} ${date.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}`
  return date.toLocaleDateString('tr-TR',{day:'numeric',month:'short',...(range==='1Y'||range==='5Y'||range==='Maks.'?{year:'numeric'}:{})})
}

function historyPeriod(points:{timestamp:number}[]) {
  if(!points.length)return ''
  const format=(timestamp:number)=>new Date(timestamp*1000).toLocaleString('tr-TR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  return `${format(points[0].timestamp)} - ${format(points[points.length-1].timestamp)}`
}

function zeroRangePoints(range:MarketRange) {
  const end=new Date(),start=marketRangeStart(range,end)
  return [start,end].map(date=>({timestamp:Math.floor(date.getTime()/1000),label:historyLabel(date.getTime()/1000,range)}))
}

function Assets({assets,entries,onDelete,onChanged}:{assets:Asset[];entries:Entry[];onDelete:(id:string)=>void;onChanged:()=>void}) {
  const monthlyBalance = currentMonthlyBalance(entries)
  const [view,setView]=useState<'portfolio'|'performance'|'watchlist'|'discover'>('portfolio')
  const [range,setRange]=useState<MarketRange>('1A')
  const [analysisMode,setAnalysisMode]=useState<'performance'|'flow'>('performance')
  const [hidden,setHidden]=useState(()=>localStorage.getItem('asset-balance-hidden')==='true')
  const [currency,setCurrency]=useState<'TRY'|'USD'>(()=>localStorage.getItem('asset-currency')==='USD'?'USD':'TRY')
  const [usdTry,setUsdTry]=useState(1)
  const [detail,setDetail]=useState<Asset|null>(null)
  const [watchQuery,setWatchQuery]=useState('')
  const [watchKeys,setWatchKeys]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('asset-watchlist')||'[]')}catch{return []}})
  const [watchPrices,setWatchPrices]=useState<Record<string,number>>({})
  const [collapsedGroups,setCollapsedGroups]=useState<string[]>([])
  const [performanceData,setPerformanceData]=useState<{label:string;value:number}[]>([])
  const [performanceLoading,setPerformanceLoading]=useState(false)
  const [trade,setTrade]=useState<{asset:Asset;side:'buy'|'sell'}|null>(null)
  const total = assets.reduce((sum, asset) => sum + resolvedAssetValue(asset, monthlyBalance), 0)
  const cost = assets.reduce((sum, asset) => sum + (asset.symbol === MONTHLY_BALANCE_SYMBOL ? 0 : Number(asset.units) * Number(asset.average_cost)), 0)
  const gain = total - cost
  const gainRate = cost > 0 ? gain / cost * 100 : 0
  const groupedAssets=Object.values(assets.reduce((acc,asset)=>{const name=asset.kind==='Döviz'?'Para':asset.kind==='Altın'?'Kıymetli Madenler':asset.kind||'Diğer';acc[name]||={name,items:[],value:0,cost:0};acc[name].items.push(asset);acc[name].value+=resolvedAssetValue(asset,monthlyBalance);acc[name].cost+=asset.symbol===MONTHLY_BALANCE_SYMBOL?0:Number(asset.units)*Number(asset.average_cost);return acc},{} as Record<string,{name:string;items:Asset[];value:number;cost:number}>)).sort((a,b)=>b.value-a.value)
  const allocationData=groupedAssets.map(group=>({name:group.name,value:Math.max(0,group.value),color:assetCategoryColors[group.name]||assetCategoryColors.Diğer})).filter(group=>group.value>0)
  const allocationTotal=allocationData.reduce((sum,group)=>sum+group.value,0)
  const watchItems=watchKeys.flatMap(key=>{const item=assetCatalog.find(candidate=>`${candidate.kind}:${candidate.symbol}`===key);return item?[item]:[]})
  const watchResults=watchQuery.trim()?assetCatalog.flatMap(item=>{if(item.kind!=='Hisse'&&item.kind!=='Fon'&&item.kind!=='Kripto'&&item.kind!=='Endeks')return [];const score=assetSearchScore(item,watchQuery);return score===null?[]:[{item,score}]}).sort((left,right)=>left.score-right.score||left.item.name.localeCompare(right.item.name,'tr')).slice(0,8).map(result=>result.item):[]
  const formatMoney=(value:number)=>hidden?'******':currency==='USD'?new Intl.NumberFormat('tr-TR',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value/Math.max(usdTry,1)):trMoney.format(value)
  const cashReturns=useMemo(()=>{const result={interest:0,dividend:0};entries.filter(entry=>entry.kind==='income').forEach(entry=>{const text=`${entry.title} ${entry.category_name||''}`.toLocaleLowerCase('tr');if(text.includes('temettü'))result.dividend+=Number(entry.amount);if(text.includes('faiz')||text.includes('nema'))result.interest+=Number(entry.amount)});return result},[entries])
  useEffect(()=>{localStorage.setItem('asset-balance-hidden',String(hidden))},[hidden])
  useEffect(()=>{localStorage.setItem('asset-currency',currency)},[currency])
  useEffect(()=>{localStorage.setItem('asset-watchlist',JSON.stringify(watchKeys))},[watchKeys])
  useEffect(()=>{const usd=assetCatalog.find(item=>item.kind==='Para'&&item.symbol==='USD');if(usd)fetchHistoricalAssetPrice(usd,today).then(value=>value&&setUsdTry(value)).catch(()=>{})},[])
  useEffect(()=>{let cancelled=false;Promise.allSettled(watchItems.map(async item=>({key:`${item.kind}:${item.symbol}`,price:await fetchHistoricalAssetPrice(item,today)}))).then(results=>{if(cancelled)return;setWatchPrices(Object.fromEntries(results.flatMap(result=>result.status==='fulfilled'&&result.value.price?[[result.value.key,result.value.price]]:[])))});return()=>{cancelled=true}},[watchKeys.join('|')])
  useEffect(()=>{let cancelled=false;setPerformanceLoading(true);const end=Date.now(),start=marketRangeStart(range).getTime();Promise.all(assets.map(async asset=>({asset,history:await fetchAssetHistory(asset,range)}))).then(series=>{if(cancelled)return;const timestamps=[...new Set(series.flatMap(item=>item.history.map(point=>point.timestamp*1000)).filter(timestamp=>timestamp>=start&&timestamp<=end))].sort((a,b)=>a-b);const data=timestamps.map(timestamp=>{let value=0;for(const {asset,history} of series){const purchase=asset.purchase_date?new Date(`${asset.purchase_date}T12:00:00`).getTime():start;if(timestamp<purchase)continue;const point=[...history].reverse().find(item=>item.timestamp*1000<=timestamp);const assetCost=Number(asset.units)*Number(asset.average_cost);value+=analysisMode==='flow'?assetCost:(point?.price??Number(asset.current_price))*Number(asset.units)}return {label:historyLabel(timestamp/1000,range),value}});setPerformanceData(data.length>1?data:zeroRangePoints(range).map(point=>({label:point.label,value:0})))}).finally(()=>{if(!cancelled)setPerformanceLoading(false)});return()=>{cancelled=true}},[assets,range,analysisMode,monthlyBalance])
  function toggleWatch(item:AssetCatalogItem){const key=`${item.kind}:${item.symbol}`;setWatchKeys(keys=>keys.includes(key)?keys.filter(value=>value!==key):[...keys,key])}
  async function openWatch(item:AssetCatalogItem){const price=watchPrices[`${item.kind}:${item.symbol}`]||(await fetchHistoricalAssetPrice(item,today).catch(()=>0))||0;setDetail({id:`watch-${item.symbol}`,user_id:'',name:item.name,symbol:item.symbol,kind:item.kind,units:1,average_cost:price,current_price:price})}
  function toggleGroup(name:string){setCollapsedGroups(groups=>groups.includes(name)?groups.filter(group=>group!==name):[...groups,name])}
  return <div className="page-content assets-page midas-assets">
    <section className="assets-portfolio">
      <div className="portfolio-head"><small>Toplam Varlığım</small><div><button className="icon-button subtle" title={hidden?'Bakiyeyi göster':'Bakiyeyi gizle'} onClick={()=>setHidden(value=>!value)}>{hidden?<EyeOff/>:<Eye/>}</button><div className="currency-toggle"><button className={currency==='TRY'?'active':''} onClick={()=>setCurrency('TRY')}><span className="turkish-lira-symbol">₺</span></button><button className={currency==='USD'?'active':''} onClick={()=>setCurrency('USD')}>$</button></div></div></div>
      <strong>{formatMoney(total)}</strong>
      <div className={`portfolio-change ${gain >= 0 ? 'positive' : 'negative'}`}><span>{hidden?'******':`${gain>=0?'+':''}${formatMoney(gain)}`}</span><b>{gainRate.toLocaleString('tr-TR',{maximumFractionDigits:2})}%</b></div>
      <div className="portfolio-meta"><span>Maliyet <b>{formatMoney(cost)}</b></span><span>{currency==='USD'&&usdTry>1?`1 USD = ${trMoney.format(usdTry)}`:`${assets.length.toLocaleString('tr-TR')} varlık`}</span></div>
      {groupedAssets.length>0&&<div className="portfolio-strip">{groupedAssets.map((group,index)=><i key={group.name} className={`type-${index%6}`} style={{width:`${Math.max(4,total?Math.max(0,group.value)/Math.max(total,1)*100:0)}%`}} title={group.name}/>)}</div>}
    </section>
    <nav className="asset-view-tabs four"><button className={view==='portfolio'?'active':''} onClick={()=>setView('portfolio')}><WalletCards/>Portföy</button><button className={view==='performance'?'active':''} onClick={()=>setView('performance')}><ChartNoAxesCombined/>Analiz</button><button className={view==='watchlist'?'active':''} onClick={()=>setView('watchlist')}><ListPlus/>Takip</button><button className={view==='discover'?'active':''} onClick={()=>setView('discover')}><Compass/>Keşfet</button></nav>
    {view==='portfolio'&&<div className="asset-groups">{groupedAssets.length?groupedAssets.map(group=>{const groupGain=group.value-group.cost,collapsed=collapsedGroups.includes(group.name);return <section className="assets-market asset-group" key={group.name}><header><button className="group-toggle" onClick={()=>toggleGroup(group.name)}><span><h2>{group.name}</h2><p>{group.items.length} varlık</p></span><ChevronDown className={collapsed?'collapsed':''}/></button><div className="group-summary"><b>{formatMoney(group.value)}</b><small className={groupGain>=0?'positive':'negative'}>{groupGain>=0?'+':''}{formatMoney(groupGain)}</small></div></header>{!collapsed&&<div className="asset-list">{group.items.map(asset=><AssetRow key={asset.id} asset={asset} total={total} monthlyBalance={monthlyBalance} formatMoney={formatMoney} onOpen={()=>setDetail(asset)} onDelete={onDelete}/>)}</div>}</section>}):<Empty text="Henüz varlık eklenmedi."/>}<p className="market-delay">BIST hisse fiyatları Yahoo Finance üzerinden 15 dakika gecikmeli güncellenir. Fon fiyatları TEFAS tarafından gün içinde periyodik yayınlanır.</p></div>}
    {view==='performance'&&<section className="portfolio-analysis panel"><header><div><small>{analysisMode==='performance'?'Değişim':'Toplam varlık akışı'}</small><strong>{formatMoney(analysisMode==='performance'?gain:total)}</strong><span className={gain>=0?'positive':'negative'}>{gainRate.toLocaleString('tr-TR',{maximumFractionDigits:2})}%</span></div><div className="analysis-mode"><button className={analysisMode==='performance'?'active':''} onClick={()=>setAnalysisMode('performance')}>Performans</button><button className={analysisMode==='flow'?'active':''} onClick={()=>setAnalysisMode('flow')}>Varlık akışı</button></div></header><div className="portfolio-chart">{performanceLoading?<div className="chart-loading">Grafik hazırlanıyor…</div>:<ResponsiveContainer><AreaChart data={performanceData}><defs><linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d8b68" stopOpacity=".28"/><stop offset="1" stopColor="#3d8b68" stopOpacity="0"/></linearGradient></defs><XAxis dataKey="label" hide/><YAxis hide domain={performanceData.some(point=>point.value!==0)?['dataMin','dataMax']:[0,1]}/><Tooltip formatter={(value:number)=>formatMoney(value)} labelStyle={{color:'#69736d'}}/><Area type="monotone" dataKey="value" stroke="#3d8b68" strokeWidth={2.4} fill="url(#portfolioFill)" dot={false} activeDot={{r:4}}/></AreaChart></ResponsiveContainer>}</div><RangeTabs value={range} onChange={setRange}/><div className="analysis-stats"><span>Maliyet<b>{formatMoney(cost)}</b></span><span>Güncel değer<b>{formatMoney(total)}</b></span><span>Toplam getiri<b className={gain>=0?'positive':'negative'}>{formatMoney(gain)}</b></span></div><div className="asset-allocation"><h3>Varlık dağılımı</h3><div className="donut-wrap asset-allocation-wrap"><div className="donut-stage"><div className="donut"><ResponsiveContainer><PieChart><Pie data={allocationData.length?allocationData:[{name:'Veri yok',value:1,color:'#e4e6e1'}]} innerRadius="55%" outerRadius="90%" dataKey="value" stroke="none" isAnimationActive={false}>{(allocationData.length?allocationData:[{color:'#e4e6e1'}]).map((group,index)=><Cell key={`${group.color}-${index}`} fill={group.color}/>)}</Pie></PieChart></ResponsiveContainer><div><b>{formatMoney(allocationTotal)}</b><small>toplam</small></div></div></div><div className="allocation-legend">{allocationData.length?allocationData.map(group=><div key={group.name}><i style={{background:group.color}}/><b>%{allocationTotal?Math.round(group.value/allocationTotal*100):0}</b><span>{group.name}</span><small>{formatMoney(group.value)}</small></div>):<p>Henüz dağılım verisi yok.</p>}</div></div></div><div className="cash-returns"><h3>Nakit getirileri</h3><div><span>TL nema<b>{formatMoney(cashReturns.interest)}</b></span><span>TL temettü<b>{formatMoney(cashReturns.dividend)}</b></span><span>USD nema<b>{currency==='USD'?formatMoney(cashReturns.interest):'$0,00'}</b></span><span>USD temettü<b>$0,00</b></span></div></div></section>}
    {view==='watchlist'&&<section className="watchlist-panel panel"><header><div><h2>Takip Ettiklerim</h2><p>{watchItems.length} varlık</p></div><RangeTabs value={range} onChange={setRange}/></header><label className="search watch-search"><Search/><input placeholder="Hisse, fon, kripto veya endeks ara" value={watchQuery} onChange={event=>setWatchQuery(event.target.value)}/></label>{watchResults.length>0&&<div className="watch-search-results">{watchResults.map(item=>{const watched=watchKeys.includes(`${item.kind}:${item.symbol}`);return <button key={`${item.kind}-${item.symbol}`} onClick={()=>toggleWatch(item)}><span><b>{item.symbol}</b><small>{item.kind} · {item.name}</small></span>{watched?<BookmarkCheck/>:<Bookmark/>}</button>})}</div>}<div className="watch-list">{watchItems.map(item=>{const key=`${item.kind}:${item.symbol}`,price=watchPrices[key];return <button key={key} onClick={()=>openWatch(item)}><span className="asset-symbol"><b>{item.symbol.slice(0,3)}</b></span><span><b>{item.symbol}</b><small>{item.name}</small></span><span><b>{price?formatMoney(price):'—'}</b><small className="positive">{item.kind}</small></span><BookmarkCheck onClick={event=>{event.stopPropagation();toggleWatch(item)}}/></button>})}{!watchItems.length&&<Empty text="Arama yaparak takip listene varlık ekleyebilirsin."/>}</div></section>}
    {view==='discover'&&<MarketDiscover formatMoney={formatMoney} watched={watchKeys} toggleWatch={toggleWatch} openItem={item=>{setWatchQuery('');openWatch(item)}}/>}
    {detail&&<AssetDetail asset={detail} monthlyBalance={monthlyBalance} formatMoney={formatMoney} watched={watchKeys.includes(`${detail.kind}:${detail.symbol}`)} close={()=>setDetail(null)} toggleWatch={()=>{const item=assetCatalog.find(candidate=>candidate.kind===detail.kind&&candidate.symbol===detail.symbol);if(item)toggleWatch(item)}} trade={detail.id.startsWith('watch-')?undefined:side=>setTrade({asset:detail,side})}/>}
    {trade&&<PositionAdjustModal asset={trade.asset} side={trade.side} close={()=>setTrade(null)} saved={()=>{setTrade(null);setDetail(null);onChanged()}}/>}
  </div>
}

function RangeTabs({value,onChange}:{value:MarketRange;onChange:(range:MarketRange)=>void}) { return <div className="asset-range-tabs">{assetRanges.map(range=><button key={range} className={value===range?'active':''} onClick={()=>onChange(range)}>{range}</button>)}</div> }

function MarketDiscover({formatMoney,watched,toggleWatch,openItem}:{formatMoney:(value:number)=>string;watched:string[];toggleWatch:(item:AssetCatalogItem)=>void;openItem:(item:AssetCatalogItem)=>void}) {
  const [query,setQuery]=useState(''),[category,setCategory]=useState<'Tümü'|'Türkiye'|'ABD'|'Fonlar'|'Kripto'>('Tümü')
  const [quotes,setQuotes]=useState<Record<string,{price:number;change:number}>>({})
  const [recent,setRecent]=useState<AssetCatalogItem[]>(()=>{try{return JSON.parse(localStorage.getItem('asset-recent-searches')||'[]')}catch{return []}})
  const dayOpen=useRef<Record<string,number>>({})
  const featured=useMemo(()=>['XU100','SPX','NDX','DJI','BTC','TI1','ASELS','AAPL'].flatMap(symbol=>{const item=assetCatalog.find(candidate=>candidate.symbol===symbol);return item?[item]:[]}),[])
  const results=useMemo(()=>assetCatalog.flatMap(item=>{
    const categoryMatch=category==='Tümü'||(category==='Türkiye'&&(item.exchange==='BIST'||item.dataSource==='tefas'))||(category==='ABD'&&(item.exchange==='NASDAQ'||item.exchange==='NYSE'))||(category==='Fonlar'&&item.kind==='Fon')||(category==='Kripto'&&item.kind==='Kripto')
    if(!categoryMatch)return []
    const score=assetSearchScore(item,query)
    return score===null?[]:[{item,score}]
  }).filter((result,index,list)=>list.findIndex(candidate=>candidate.item.kind===result.item.kind&&candidate.item.symbol===result.item.symbol)===index).sort((left,right)=>left.score-right.score||left.item.name.localeCompare(right.item.name,'tr')).slice(0,query?30:12).map(result=>result.item),[query,category])
  useEffect(()=>{let cancelled=false,running=false;async function refresh(){if(cancelled||running||document.hidden)return;running=true;const values=await Promise.allSettled(featured.map(async item=>{const key=`${item.kind}:${item.symbol}`,price=(await fetchHistoricalAssetPrice(item,today))||0;if(!dayOpen.current[key]){const asset={id:`discover-${item.symbol}`,user_id:'',name:item.name,symbol:item.symbol,kind:item.kind,units:1,average_cost:0,current_price:price};const history=await fetchAssetHistory(asset,'1G');dayOpen.current[key]=history[0]?.price||price}const first=dayOpen.current[key]||price,change=first?((price-first)/first)*100:0;return {key,price,change:Math.abs(change)<=100?change:0}}));running=false;if(!cancelled)setQuotes(Object.fromEntries(values.flatMap(value=>value.status==='fulfilled'?[[value.value.key,value.value]]:[])))}refresh();const timer=window.setInterval(refresh,15000);const visible=()=>{if(!document.hidden)refresh()};document.addEventListener('visibilitychange',visible);return()=>{cancelled=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible)}},[featured])
  function select(item:AssetCatalogItem){const next=[item,...recent.filter(candidate=>candidate.kind!==item.kind||candidate.symbol!==item.symbol)].slice(0,6);setRecent(next);localStorage.setItem('asset-recent-searches',JSON.stringify(next));openItem(item)}
  return <section className="discover-panel panel"><header><div><small>Piyasalar</small><h2>Keşfet</h2></div><Compass/></header><label className="search discover-search"><Search/><input placeholder="Hisse, fon, kripto veya endeks ara" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button title="Aramayı temizle" onClick={()=>setQuery('')}><X/></button>}</label><div className="discover-categories">{(['Tümü','Türkiye','ABD','Fonlar','Kripto'] as const).map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}</button>)}</div>
    {!query&&category==='Tümü'&&<><section className="market-overview"><h3>Piyasa özeti</h3><div>{featured.map(item=>{const quote=quotes[`${item.kind}:${item.symbol}`];return <button key={`${item.kind}-${item.symbol}`} onClick={()=>select(item)}><span><b>{item.symbol}</b><small>{item.name}</small></span><span><b>{quote?.price?formatMoney(quote.price):'—'}</b><small className={(quote?.change||0)>=0?'positive':'negative'}>{quote?`${quote.change>=0?'+':''}${quote.change.toLocaleString('tr-TR',{maximumFractionDigits:2})}%`:'—'}</small></span></button>})}</div></section>{recent.length>0&&<section className="recent-assets"><h3>Son aramalar</h3><div>{recent.map(item=><button key={`${item.kind}-${item.symbol}`} onClick={()=>select(item)}><span className="asset-symbol"><b>{item.symbol.slice(0,3)}</b></span><span><b>{item.symbol}</b><small>{item.name}</small></span><ChevronRight/></button>)}</div></section>}</>}
    {(query||category!=='Tümü')&&<section className="discover-results"><h3>{query?'Arama sonuçları':category}</h3>{results.map(item=>{const key=`${item.kind}:${item.symbol}`;return <div className="discover-result-row" key={key} onClick={()=>select(item)}><span className="asset-symbol"><b>{item.symbol.slice(0,3)}</b></span><span><b>{item.symbol}</b><small>{item.name}</small></span><small>{item.kind}</small><button className="icon-button subtle" title={watched.includes(key)?'Takipten çıkar':'Takip et'} onClick={event=>{event.stopPropagation();toggleWatch(item)}}>{watched.includes(key)?<BookmarkCheck/>:<Bookmark/>}</button></div>})}{!results.length&&<Empty text="Aramana uygun varlık bulunamadı."/>}</section>}
  </section>
}

function AssetRow({asset,total,monthlyBalance,formatMoney,onOpen,onDelete}:{asset:Asset;total:number;monthlyBalance:number;formatMoney:(value:number)=>string;onOpen:()=>void;onDelete:(id:string)=>void}) {
  const isMonthlyBalance = asset.symbol === MONTHLY_BALANCE_SYMBOL
  const value = resolvedAssetValue(asset, monthlyBalance)
  const cost = isMonthlyBalance ? 0 : Number(asset.units) * Number(asset.average_cost)
  const gain = value - cost
  const rate = cost > 0 ? gain / cost * 100 : 0
  const share = total > 0 ? value / total * 100 : 0
  return <div className="asset-row clickable" onClick={onOpen}>
    <div className="asset-symbol"><b>{(asset.symbol || asset.name).slice(0,3).toLocaleUpperCase('tr')}</b><small>{asset.kind}</small></div>
    <div className="asset-main"><b>{asset.name}</b><span>{isMonthlyBalance ? 'Bu ayın gelir - gider farkı' : `${Number(asset.units).toLocaleString('tr-TR')} adet`} · {share.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}% portföy</span></div>
    <div className="asset-value"><b>{formatMoney(value)}</b><span>{isMonthlyBalance ? 'Otomatik hesaplanır' : `Ort. ${formatMoney(Number(asset.average_cost))}`}</span></div>
    <div className={`asset-gain ${gain >= 0 ? 'positive' : 'negative'}`}><b>{gain >= 0 ? '+' : ''}{formatMoney(gain)}</b><span>{isMonthlyBalance ? 'Bu ay' : `${rate.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}%`}</span></div>
    <button className="icon-button subtle danger" title="Varlığı sil" onClick={event=>{event.stopPropagation();if(confirm('Bu varlık silinsin mi?'))onDelete(asset.id)}}><Trash2/></button>
  </div>
}

function AssetDetail({asset,monthlyBalance,formatMoney,watched,close,toggleWatch,trade}:{asset:Asset;monthlyBalance:number;formatMoney:(value:number)=>string;watched:boolean;close:()=>void;toggleWatch:()=>void;trade?:(side:'buy'|'sell')=>void}) {
  const [range,setRange]=useState<MarketRange>('1A'),[points,setPoints]=useState<{timestamp:number;label:string;price:number;value:number}[]>([]),[loading,setLoading]=useState(true),[fund,setFund]=useState<FundSnapshot|null>(null)
  const value=resolvedAssetValue(asset,monthlyBalance),cost=asset.symbol===MONTHLY_BALANCE_SYMBOL?0:Number(asset.units)*Number(asset.average_cost),gain=value-cost,rate=cost>0?gain/cost*100:0
  useEffect(()=>{let cancelled=false;setLoading(true);fetchAssetHistory(asset,range).then(history=>{if(!cancelled)setPoints(history.map(point=>({timestamp:point.timestamp,label:historyLabel(point.timestamp,range),price:point.price,value:point.price*Number(asset.units)})))}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[asset.id,range])
  useEffect(()=>{let cancelled=false;if(asset.kind==='Fon')fetchFundSnapshot(asset.symbol).then(value=>{if(!cancelled)setFund(value)});return()=>{cancelled=true}},[asset.kind,asset.symbol])
  const first=points[0]?.price||Number(asset.average_cost),last=points[points.length-1]?.price||Number(asset.current_price),periodChange=last-first,positive=periodChange>=0
  const periodRate=first?periodChange/first*100:0
  const chartPoints=points.length>1?points:zeroRangePoints(range).map(point=>({...point,price:0,value:0}))
  async function share(){const text=`${asset.symbol} · ${asset.name}`;if(navigator.share)await navigator.share({title:text,text});else await navigator.clipboard.writeText(text)}
  return <div className="asset-detail-backdrop"><section className="asset-detail"><header><button className="icon-button subtle" title="Geri" onClick={close}><ArrowLeft/></button><div><b>{asset.symbol}</b><small>{asset.name}</small></div><div className="detail-actions"><button className="icon-button subtle" title="Paylaş" onClick={share}><Share2/></button><button className="icon-button subtle" title={watched?'Takipten çıkar':'Takip et'} onClick={toggleWatch}>{watched?<BookmarkCheck/>:<Bookmark/>}</button></div></header><div className="detail-quote"><small>Güncel fiyat</small><strong>{formatMoney(last)}</strong><span className={positive?'positive':'negative'}>{periodChange>=0?'+':''}{formatMoney(periodChange)} · {periodRate>=0?'+':''}{periodRate.toLocaleString('tr-TR',{maximumFractionDigits:2})}%</span></div><div className={`asset-detail-chart ${positive?'positive':'negative'}`}>{loading?<div className="chart-loading">Grafik hazırlanıyor…</div>:<ResponsiveContainer><AreaChart data={chartPoints}><defs><linearGradient id="assetDetailFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={positive?'#3d8b68':'#dc5b4f'} stopOpacity=".25"/><stop offset="1" stopColor={positive?'#3d8b68':'#dc5b4f'} stopOpacity="0"/></linearGradient></defs><XAxis dataKey="label" hide/><YAxis hide domain={points.length>1?['dataMin','dataMax']:[0,1]}/><Tooltip formatter={(price:number)=>formatMoney(price)} labelStyle={{color:'#69736d'}}/><Area type="monotone" dataKey="price" stroke={positive?'#3d8b68':'#dc5b4f'} strokeWidth={2.2} fill="url(#assetDetailFill)" dot={false} activeDot={{r:4}}/></AreaChart></ResponsiveContainer>}</div>{points.length>1&&<div className="chart-period">{historyPeriod(points)}</div>}<RangeTabs value={range} onChange={setRange}/><section className="position-summary"><h3>Pozisyonum</h3><div><span>Adet<b>{Number(asset.units).toLocaleString('tr-TR')}</b></span><span>Toplam değer<b>{formatMoney(value)}</b></span><span>Ort. fiyat<b>{formatMoney(Number(asset.average_cost))}</b></span><span>Portföy getirisi<b className={gain>=0?'positive':'negative'}>{rate.toLocaleString('tr-TR',{maximumFractionDigits:2})}%</b></span><span>Toplam getiri<b className={gain>=0?'positive':'negative'}>{formatMoney(gain)}</b></span><span>{range} değişim<b className={positive?'positive':'negative'}>{periodRate>=0?'+':''}{periodRate.toLocaleString('tr-TR',{maximumFractionDigits:2})}%</b></span></div></section>{fund&&<section className="fund-detail-section"><header><div><h3>Fon bilgileri</h3><p>TEFAS tarafından yayınlanan güncel veriler</p></div><Info/></header><div className="fund-stats"><span>Fon kategorisi<b>{fund.fonKategori||'—'}</b></span><span>Günlük getiri<b className={(fund.gunlukGetiri||0)>=0?'positive':'negative'}>{Number(fund.gunlukGetiri||0).toLocaleString('tr-TR')}%</b></span><span>Fon büyüklüğü<b>{formatMoney(Number(fund.portBuyukluk||0))}</b></span><span>Yatırımcı sayısı<b>{Number(fund.yatirimciSayi||0).toLocaleString('tr-TR')}</b></span><span>Kategori sırası<b>{fund.kategoriDerece&&fund.kategoriFonSay?`${fund.kategoriDerece} / ${fund.kategoriFonSay}`:'—'}</b></span><span>Pazar payı<b>{Number(fund.pazarPayi||0).toLocaleString('tr-TR')}%</b></span></div></section>}{trade&&<div className="detail-trade-actions"><button className="sell" onClick={()=>trade('sell')}>Sat</button><button className="buy" onClick={()=>trade('buy')}>Al</button></div>}</section></div>
}

function PositionAdjustModal({asset,side,close,saved}:{asset:Asset;side:'buy'|'sell';close:()=>void;saved:()=>void}) {
  const [units,setUnits]=useState(''),[price,setPrice]=useState(String(asset.current_price||asset.average_cost||'')),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  async function submit(event:FormEvent){event.preventDefault();const quantity=Number(units.replace(',','.')),unitPrice=Number(price.replace(',','.'));if(quantity<=0||unitPrice<=0)return setMessage('Adet ve fiyat sıfırdan büyük olmalı.');if(side==='sell'&&quantity>Number(asset.units))return setMessage('Satış adedi mevcut adetten fazla olamaz.');setBusy(true);const nextUnits=side==='buy'?Number(asset.units)+quantity:Number(asset.units)-quantity;const nextAverage=side==='buy'?(Number(asset.units)*Number(asset.average_cost)+quantity*unitPrice)/nextUnits:Number(asset.average_cost);const result=nextUnits===0?await supabase.from('assets').delete().eq('id',asset.id):await supabase.from('assets').update({units:nextUnits,average_cost:nextAverage,current_price:unitPrice}).eq('id',asset.id);setBusy(false);if(result.error)setMessage(result.error.message);else saved()}
  return <Modal title={side==='buy'?'Varlık al':'Varlık sat'} close={close}><form className="trade-form" onSubmit={submit}><div className="trade-asset"><span className="asset-symbol"><b>{asset.symbol.slice(0,3)}</b></span><span><b>{asset.symbol}</b><small>{asset.name} · Mevcut {Number(asset.units).toLocaleString('tr-TR')} adet</small></span></div><label>Adet<input required min="0.000001" step="any" inputMode="decimal" type="number" value={units} onChange={event=>setUnits(event.target.value)}/></label><label>İşlem fiyatı<input required min="0.000001" step="any" inputMode="decimal" type="number" value={price} onChange={event=>setPrice(event.target.value)}/></label>{message&&<p className="form-message error">{message}</p>}<div className="form-actions"><button type="button" onClick={close}>Vazgeç</button><button className={`primary ${side}`} disabled={busy}>{busy?'Kaydediliyor…':side==='buy'?'Alımı kaydet':'Satışı kaydet'}</button></div></form></Modal>
}

function SettingsPage({theme,setTheme,email,catAlerts,setCatAlerts,openCategories,openGuide}:{theme:'light'|'dark';setTheme:(x:'light'|'dark')=>void;email:string;catAlerts:boolean;setCatAlerts:(x:boolean)=>void;openCategories:()=>void;openGuide:()=>void}) { const [message,setMessage]=useState(''); async function resetPassword(){const redirectTo=new URL(import.meta.env.BASE_URL,window.location.origin).toString();const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});setMessage(error?.message||'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.')} return <div className="page-content settings-page"><section className="panel settings-list"><div className="settings-row" data-tour="settings"><span className="settings-icon">{theme==='light'?<Sun/>:<Moon/>}</span><span><b>Görünüm</b><small>{theme==='light'?'Açık tema':'Koyu tema'}</small></span><label className="switch"><input type="checkbox" checked={theme==='dark'} onChange={e=>setTheme(e.target.checked?'dark':'light')}/><span/></label></div><div className="settings-row"><span className="settings-icon"><img src={`${import.meta.env.BASE_URL}happy-cat.png`} alt="" /></span><span><b>Kedi bildirimi</b><small>Gelir ve gider kaydında görsel bildirim göster</small></span><label className="switch"><input type="checkbox" checked={catAlerts} onChange={e=>setCatAlerts(e.target.checked)}/><span/></label></div><button onClick={openGuide}><span className="settings-icon"><HelpCircle/></span><span><b>Nasıl kullanılır?</b><small>Ekran üzerinde adım adım göster</small></span><ChevronRight/></button><button onClick={openCategories}><span className="settings-icon"><Tags/></span><span><b>Kategoriler</b><small>Gelir ve gider kategorilerini yönetin</small></span><ChevronRight/></button><button onClick={resetPassword}><span className="settings-icon"><KeyRound/></span><span><b>Şifre sıfırla</b><small>{email}</small></span><ChevronRight/></button>{message&&<div className="settings-message">{message}</div>}<button onClick={()=>supabase.auth.signOut()}><span className="settings-icon"><LogOut/></span><span><b>Çıkış yap</b><small>{email}</small></span><ChevronRight/></button></section></div> }

function EntryModal({userId,categories,entry,close,saved,onCategoryAdded}:{userId:string;categories:Category[];entry:Entry|null;close:()=>void;saved:(kind:FlowKind)=>void;onCategoryAdded:(category:Category)=>void}) {
  const [kind,setKind]=useState<FlowKind>(entry?.kind||'expense'), [cadence,setCadence]=useState<Cadence>(entry?.cadence||'one_time'), [title,setTitle]=useState(entry?.title||''), [amount,setAmount]=useState(entry?.amount?.toString()||''), [category,setCategory]=useState(entry?.category_id||''), [date,setDate]=useState(entry?.entry_date||today), [installments,setInstallments]=useState(entry?.installment_count?.toString()||''), [busy,setBusy]=useState(false)
  const [quickOpen,setQuickOpen]=useState(false), [quickName,setQuickName]=useState(''), [quickColor,setQuickColor]=useState('#3f8f74'), [quickOne,setQuickOne]=useState(cadence==='one_time'), [quickRecurring,setQuickRecurring]=useState(cadence==='recurring')
  const [localCategories,setLocalCategories]=useState(categories)
  useEffect(()=>setLocalCategories(categories),[categories])
  const available=useMemo(()=>localCategories.filter(c=>c.kind===kind&&(cadence==='recurring'?c.recurring:c.one_time)),[localCategories,kind,cadence])
  useEffect(()=>{if(!available.some(c=>c.id===category))setCategory(available[0]?.id||'')},[kind,cadence,category,available])
  useEffect(()=>{if(!quickOpen){setQuickOne(cadence==='one_time');setQuickRecurring(cadence==='recurring')}},[cadence,quickOpen])
  async function addQuickCategory(){if(!quickName.trim()||(!quickOne&&!quickRecurring))return;setBusy(true);const {data,error}=await supabase.from('categories').insert({user_id:userId,name:quickName.trim(),color:quickColor,kind,one_time:quickOne,recurring:quickRecurring}).select('*').single();setBusy(false);if(error)return alert(error.message);if(data){const created=data as Category;setLocalCategories(items=>[...items,created].sort((left,right)=>left.name.localeCompare(right.name,'tr')));onCategoryAdded(created);setCategory(created.id);setQuickName('');setQuickOpen(false)}}
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);const payload={user_id:userId,title:title.trim(),amount:Number(amount.replace(',','.')),category_id:category||null,kind,cadence,entry_date:date,note:'',installment_count:kind==='expense'&&cadence==='recurring'&&Number(installments)>1?Number(installments):null,notification_enabled:false}; const result=entry?await supabase.from('entries').update(payload).eq('id',entry.id):await supabase.from('entries').insert(payload);setBusy(false);if(result.error)alert(result.error.message);else saved(kind)}
  return <Modal title={entry?'Hareketi düzenle':'Harcama kaydı'} close={close}><form className="form-grid" onSubmit={submit}><div className="segment full"><button type="button" className={kind==='expense'?'active expense':''} onClick={()=>setKind('expense')}>Gider</button><button type="button" className={kind==='income'?'active income':''} onClick={()=>setKind('income')}>Gelir</button></div><label>Başlık<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Tutar<input required min="0.01" step="0.01" inputMode="decimal" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Tür<select value={cadence} onChange={e=>setCadence(e.target.value as Cadence)}><option value="one_time">Tek seferlik</option><option value="recurring">Düzenli</option></select></label><div className="field-with-action"><label>Kategori<select required value={category} onChange={e=>setCategory(e.target.value)}><option value="">Kategori seçin</option>{available.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button type="button" className="icon-button" title="Kategori ekle" onClick={()=>setQuickOpen(open=>{if(!open){setQuickName('');setQuickOne(cadence==='one_time');setQuickRecurring(cadence==='recurring')}return !open})}><Plus/></button></div>{quickOpen&&<div className="quick-category full" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addQuickCategory()}}}><b>Yeni {kind==='income'?'gelir':'gider'} kategorisi</b><div><input maxLength={60} placeholder="Kategori adı" value={quickName} onChange={e=>setQuickName(e.target.value)}/><input aria-label="Kategori rengi" type="color" value={quickColor} onChange={e=>setQuickColor(e.target.value)}/><label><input type="checkbox" checked={quickOne} onChange={e=>setQuickOne(e.target.checked)}/> Tek seferlik</label><label><input type="checkbox" checked={quickRecurring} onChange={e=>setQuickRecurring(e.target.checked)}/> Düzenli</label><button type="button" className="primary" disabled={busy||!quickName.trim()||(!quickOne&&!quickRecurring)} onClick={addQuickCategory}><Plus/>Ekle</button></div></div>}<label>Tarih<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{kind==='expense'&&cadence==='recurring'&&<label>Taksit sayısı<input type="number" inputMode="numeric" min="2" max="120" placeholder="Peşin için boş bırakın" value={installments} onChange={e=>setInstallments(e.target.value)}/></label>}<div className="form-actions full"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={busy}>{busy?'Kaydediliyor…':'Kaydet'}</button></div></form></Modal>
}

function guideTarget(spot:string):Page { return spot==='filters'||spot==='category-action'||spot==='category-list'?'transactions':spot==='charts'||spot==='top-action'?'dashboard':spot==='settings'?'settings':'dashboard' }
function GuideModal({goTo,showCategories,hideCategories,close}:{goTo:(page:Page)=>void;showCategories:()=>void;hideCategories:()=>void;close:()=>void}) {
  const [step,setStep]=useState(0), item=guideSteps[step]
  const [rect,setRect]=useState<{left:number;top:number;width:number;height:number}|null>(null)
  useEffect(()=>{goTo(guideTarget(item.spot));if(item.spot==='category-list')showCategories();else hideCategories()},[item.spot])
  useEffect(()=>{
    let timer=0
    function target(){const nodes=Array.from(document.querySelectorAll(`[data-tour="${item.spot}"]`)) as HTMLElement[];return nodes.find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0})}
    function measure(){const node=target();if(!node){setRect(null);return}const r=node.getBoundingClientRect(), pad=8;setRect({left:Math.max(8,r.left-pad),top:Math.max(8,r.top-pad),width:Math.min(window.innerWidth-Math.max(8,r.left-pad)-8,r.width+pad*2),height:Math.min(window.innerHeight-Math.max(8,r.top-pad)-8,r.height+pad*2)})}
    const raf=window.requestAnimationFrame(()=>{const node=target();node?.scrollIntoView({block:'center',behavior:'smooth'});timer=window.setTimeout(measure,360)});window.addEventListener('resize',measure);window.addEventListener('scroll',measure,{passive:true});return()=>{window.cancelAnimationFrame(raf);window.clearTimeout(timer);window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure)}
  },[item.spot])
  const holeStyle=rect?{left:rect.left,top:rect.top,width:rect.width,height:rect.height}:undefined
  const cardStyle=rect?{left:Math.min(Math.max(16,rect.left),window.innerWidth-400),top:rect.top+rect.height+220<window.innerHeight?rect.top+rect.height+18:Math.max(16,rect.top-230)}:undefined
  return <div className={`tour-backdrop tour-${item.spot}`}><div className="tour-hole" style={holeStyle}/><section className="tour-card" style={cardStyle}><small>{step+1} / {guideSteps.length}</small><h2>{item.title}</h2><p>{item.text}</p><div className="tour-actions"><button onClick={close}>Kapat</button><span>{guideSteps.map((_,i)=><i key={i} className={i===step?'active':''}/>)}</span><button className="primary" onClick={()=>step===guideSteps.length-1?close():setStep(step+1)}>{step===guideSteps.length-1?'Bitir':'Sonraki'}<ChevronRight/></button></div>{step>0&&<button className="tour-prev" onClick={()=>setStep(step-1)}><ChevronLeft/>Geri</button>}</section></div>
}

function CatToast({kind,text}:{kind:FlowKind;text:string}) { const file=kind==='income'?'happy-cat.png':'sad-cat.png'; return <div className={`cat-toast ${kind}`}><img src={`${import.meta.env.BASE_URL}${file}`} alt=""/><b>{text}</b></div> }

function SetupModal({userId,close,saved}:{userId:string;close:()=>void;saved:()=>void}) {
  const [step,setStep]=useState(0), [custom,setCustom]=useState<Category[]>([]), [name,setName]=useState(''), [color,setColor]=useState('#3f8f74'), [kind,setKind]=useState<FlowKind>('expense'), [one,setOne]=useState(true), [recurring,setRecurring]=useState(false), [busy,setBusy]=useState(false)
  async function addCustom(e:FormEvent){e.preventDefault();if(!one&&!recurring)return;setBusy(true);const {data,error}=await supabase.from('categories').insert({user_id:userId,name:name.trim(),color,kind,one_time:one,recurring}).select('*').single();setBusy(false);if(error)return alert(error.message);if(data)setCustom(x=>[...x,data as Category]);setName('');setOne(true);setRecurring(false)}
  return <Modal title={step===0?'Başlangıç bilgilendirmesi':'Hesap yapılandırması'} close={close} locked>{step===0?<div className="guide-content"><p className="guide-lead">Harcamaç’ta gelir-gider kaydı sağ üstten eklenir, hareketler filtrelerle yönetilir, kategoriler renkleriyle ayrılır. Bu kısa tanıtım yeni hesaplar için zorunludur; daha sonra Ayarlar bölümündeki “Nasıl kullanılır?” tuşuyla ekran üzerinde tekrar görebilirsiniz.</p><div className="onboarding-cats"><img src={`${import.meta.env.BASE_URL}happy-cat.png`} alt=""/><img src={`${import.meta.env.BASE_URL}sad-cat.png`} alt=""/></div><div className="form-actions"><button className="primary" onClick={()=>setStep(1)}>Hesabı yapılandır</button></div></div>:<div className="setup-content"><p className="guide-lead">Sık kullanılan kategoriler hesabınıza otomatik eklendi. İsterseniz burada kendi kategorinizi renk ve kullanım türüyle birlikte ekleyebilirsiniz.</p><div className="setup-category-grid">{defaultCategories.map(c=><div className="setup-category-card" key={c.name}><span className="color-dot" style={{background:c.color}}/><b>{c.name}</b><small>{c.kind==='income'?'Gelir':'Gider'} · {[c.one_time&&'Tek seferlik',c.recurring&&'Düzenli'].filter(Boolean).join(', ')}</small></div>)}</div><form className="category-add setup-add" onSubmit={addCustom}><input required maxLength={60} placeholder="Yeni kategori adı" value={name} onChange={e=>setName(e.target.value)}/><input aria-label="Kategori rengi" type="color" value={color} onChange={e=>setColor(e.target.value)}/><select value={kind} onChange={e=>setKind(e.target.value as FlowKind)}><option value="expense">Gider</option><option value="income">Gelir</option></select><label><input type="checkbox" checked={one} onChange={e=>setOne(e.target.checked)}/> Tek seferlik</label><label><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/> Düzenli</label><button className="primary" disabled={busy||!name.trim()||(!one&&!recurring)}><Plus/>Ekle</button></form>{custom.length>0&&<div className="custom-picked">{custom.map(c=><span key={c.id}><i style={{background:c.color}}/>{c.name}</span>)}</div>}<div className="form-actions"><button type="button" onClick={()=>setStep(0)}>Geri</button><button className="primary" disabled={busy} onClick={saved}>{busy?'Kaydediliyor…':'Kurulumu bitir'}</button></div></div>}</Modal>
}

function CategoryModal({userId,categories,close,reload}:{userId:string;categories:Category[];close:()=>void;reload:()=>void}) {
  const [name,setName]=useState(''),[color,setColor]=useState('#3f8f74'),[kind,setKind]=useState<FlowKind>('expense'),[one,setOne]=useState(true),[recurring,setRecurring]=useState(false),[busy,setBusy]=useState(false),[editingId,setEditingId]=useState<string|null>(null)
  function resetForm(){setName('');setColor('#3f8f74');setKind('expense');setOne(true);setRecurring(false);setEditingId(null)}
  function edit(category:Category){setEditingId(category.id);setName(category.name);setColor(category.color);setKind(category.kind);setOne(category.one_time);setRecurring(category.recurring)}
  async function save(e:FormEvent){e.preventDefault();if(!name.trim()||(!one&&!recurring))return;setBusy(true);const payload={name:name.trim(),color,kind,one_time:one,recurring};const {error}=editingId?await supabase.from('categories').update(payload).eq('id',editingId):await supabase.from('categories').insert({...payload,user_id:userId});setBusy(false);if(error)return alert(error.message);resetForm();reload()}
  return <Modal title="Kategoriler" close={close}><form className="category-add" onSubmit={save}>{editingId&&<b className="category-form-title">Kategoriyi düzenle</b>}<input required maxLength={60} placeholder="Kategori adı" value={name} onChange={e=>setName(e.target.value)}/><input aria-label="Kategori rengi" type="color" value={color} onChange={e=>setColor(e.target.value)}/><select value={kind} onChange={e=>setKind(e.target.value as FlowKind)}><option value="expense">Gider</option><option value="income">Gelir</option></select><label><input type="checkbox" checked={one} onChange={e=>setOne(e.target.checked)}/> Tek seferlik</label><label><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/> Düzenli</label><div className="category-form-actions">{editingId&&<button type="button" onClick={resetForm}>Vazgeç</button>}<button className="primary" disabled={busy||!name.trim()||(!one&&!recurring)}>{editingId?<Pencil/>:<Plus/>}{busy?'Kaydediliyor…':editingId?'Kaydet':'Ekle'}</button></div></form><div className="category-list">{categories.map((category,index)=><div className="category-swipe" data-tour={index===0?'category-list':undefined} key={category.id}><div className="category-list-row"><span className="color-dot" style={{background:category.color}}/><b>{category.name}</b><small>{category.kind==='income'?'Gelir':'Gider'} · {[category.one_time&&'Tek seferlik',category.recurring&&'Düzenli'].filter(Boolean).join(', ')}</small></div><div className="category-swipe-actions"><button title="Kategoriyi düzenle" onClick={()=>edit(category)}><Pencil/><span>Düzenle</span></button><button className="danger" title="Kategoriyi kaldır" onClick={async()=>{if(confirm('Kategori kaldırılsın mı?')){await supabase.from('categories').delete().eq('id',category.id);if(editingId===category.id)resetForm();reload()}}}><Trash2/><span>Sil</span></button></div></div>)}</div></Modal>
}

type AssetDraft = {
  step?: number
  kind?: string
  exchange?: string
  query?: string
  purchaseDate?: string
  units?: string
  price?: string
  selected?: Pick<AssetCatalogItem, 'kind' | 'symbol' | 'exchange' | 'dataSource'>
}

function GoldBarIcon() {
  return <svg className="gold-bar-icon" viewBox="0 0 60 30" aria-hidden="true">
    <path d="m8.5 7.5 9.8-4a4 4 0 0 1 2.8-.1l29.5 8.3a3 3 0 0 1 2 1.8l3.2 7.4a2.5 2.5 0 0 1-1.3 3.2l-6.1 3.2a4 4 0 0 1-2.8.3L6.9 17.4a2.8 2.8 0 0 1-1.8-3.3l1.7-4.7a3.2 3.2 0 0 1 1.7-1.9Z"/>
    <path d="m7.3 9.1 37.8 9.8 6.8-6.1"/>
    <path d="m45.1 18.9 2.7 8.5"/>
  </svg>
}
function CurrencyPairIcon() { return <span className="currency-pair-icon" aria-hidden="true"><b className="turkish-lira-symbol">₺</b><b>$</b><b>€</b></span> }

function AssetModal({userId,assets,close,saved,assetsChanged}:{userId:string;assets:Asset[];close:()=>void;saved:()=>void;assetsChanged:()=>void}) {
  const kinds = [
    { name: 'Hisse', icon: TrendingUp },
    { name: 'Kıymetli Madenler', label: 'Madenler', icon: GoldBarIcon },
    { name: 'Kripto', icon: Bitcoin },
    { name: 'Fon', icon: Landmark },
    { name: 'Para', icon: CurrencyPairIcon }
  ]
  const initialDraft=useMemo<AssetDraft>(()=>{try{return JSON.parse(sessionStorage.getItem('harcamac-asset-draft')||'{}')}catch{return {}}},[])
  const restoredKind=initialDraft.selected?.kind==='Altın'?'Kıymetli Madenler':initialDraft.selected?.kind
  const restoredSelected=initialDraft.selected?assetCatalog.find(item=>item.kind===restoredKind&&item.symbol===initialDraft.selected?.symbol&&item.exchange===initialDraft.selected?.exchange&&item.dataSource===initialDraft.selected?.dataSource)||null:null
  const initialKind=initialDraft.kind==='Döviz'?'Para':initialDraft.kind==='Altın'?'Kıymetli Madenler':initialDraft.kind||'Hisse'
  const [step,setStep]=useState(initialDraft.step||0),[kind,setKind]=useState(initialKind),[exchange,setExchange]=useState(initialDraft.exchange??'BIST'),[query,setQuery]=useState(initialDraft.query||''),[selected,setSelected]=useState<AssetCatalogItem|null>(restoredSelected),[purchaseDate,setPurchaseDate]=useState(initialDraft.purchaseDate||today),[units,setUnits]=useState(initialDraft.units||''),[price,setPrice]=useState(initialDraft.price||''),[busy,setBusy]=useState(false),[monthlyBusy,setMonthlyBusy]=useState(false),[monthlyEnabled,setMonthlyEnabled]=useState(()=>assets.some(asset=>asset.symbol===MONTHLY_BALANCE_SYMBOL))
  const hasExchangeStep=kind==='Hisse'
  const steps=hasExchangeStep?['Tür','Borsa','Sembol','Alış','Adet']:['Tür','Sembol','Alış','Adet']
  const symbolStep=hasExchangeStep?2:1, purchaseStep=symbolStep+1, unitsStep=symbolStep+2
  const priceCurrency=exchange==='NASDAQ'||exchange==='NYSE'||exchange==='ABD'?'$':exchange==='AVRUPA'?'€':'₺'
  const markets=[{id:'BIST',name:'Borsa İstanbul',note:'Türkiye',logo:'borsa-istanbul.png'},{id:'NASDAQ',name:'NASDAQ',note:'Yakında',logo:'nasdaq.svg',disabled:true},{id:'NYSE',name:'NYSE',note:'Yakında',logo:'nyse.svg',disabled:true},{id:'AVRUPA',name:'Euronext',note:'Yakında',logo:'euronext.svg',disabled:true}]
  const matches=useMemo(()=>assetCatalog.flatMap(item=>{if(item.kind!==kind||(hasExchangeStep&&item.exchange!==exchange))return [];const score=assetSearchScore(item,query);return score===null?[]:[{item,score}]}).sort((left,right)=>left.score-right.score||left.item.name.localeCompare(right.item.name,'tr')).map(result=>result.item),[kind,exchange,hasExchangeStep,query])
  useEffect(()=>{sessionStorage.setItem('harcamac-asset-draft',JSON.stringify({step,kind,exchange,query,purchaseDate,units,price,selected:selected?{kind:selected.kind,symbol:selected.symbol,exchange:selected.exchange,dataSource:selected.dataSource}:undefined}))},[step,kind,exchange,query,purchaseDate,units,price,selected])
  useEffect(()=>{if(!selected||!purchaseDate)return;let cancelled=false;setBusy(true);fetchHistoricalAssetPrice(selected,purchaseDate).then(value=>{if(!cancelled&&value)setPrice(String(value))}).catch(()=>{}).finally(()=>{if(!cancelled)setBusy(false)});return()=>{cancelled=true}},[selected,purchaseDate])
  function chooseKind(value:string){setKind(value);setExchange(value==='Hisse'?'BIST':'');setStep(0);setSelected(null);setQuery('');setPrice('')}
  function chooseExchange(value:string){setExchange(value);setSelected(null);setQuery('');setPrice('')}
  async function toggleMonthlyBalance(enabled:boolean){setMonthlyBusy(true);const existing=assets.find(asset=>asset.symbol===MONTHLY_BALANCE_SYMBOL);const {error}=enabled?await supabase.from('assets').insert({user_id:userId,name:'Aylık Denge',symbol:MONTHLY_BALANCE_SYMBOL,kind:'Para',units:1,average_cost:0,current_price:0}):existing?await supabase.from('assets').delete().eq('id',existing.id):{error:null};setMonthlyBusy(false);if(error)return alert(error.message);setMonthlyEnabled(enabled);assetsChanged()}
  function clearAndClose(){sessionStorage.removeItem('harcamac-asset-draft');close()}
  async function submit(e:FormEvent){e.preventDefault();if(!selected||!units||!price)return;setBusy(true);const payload={user_id:userId,name:selected.name,symbol:selected.symbol.toUpperCase(),kind:selected.kind,units:Number(units),average_cost:Number(price),current_price:Number(price),purchase_date:purchaseDate};const {error}=await supabase.from('assets').insert(payload);setBusy(false);if(error)alert(error.message);else{sessionStorage.removeItem('harcamac-asset-draft');saved()}}
  return <Modal title="Varlık ekle" close={clearAndClose} className={step===symbolStep?'asset-symbol-modal':''}><form className="asset-wizard" onSubmit={submit}>
    <div className="wizard-steps" style={{gridTemplateColumns:`repeat(${steps.length}, minmax(0, 1fr))`}}>{steps.map((label,index)=><span key={label} className={index===step?'active':index<step?'done':''}><em>{index+1}.</em><b>{label}</b></span>)}</div>
    {step===0&&<section className="wizard-pane asset-kind-grid">{kinds.map(item=><button type="button" key={item.name} className={kind===item.name?'active':''} onClick={()=>chooseKind(item.name)}><item.icon/><span>{item.label||item.name}</span></button>)}</section>}
    {hasExchangeStep&&step===1&&<section className="wizard-pane asset-kind-grid asset-market-grid">{markets.map(market=><button type="button" key={market.id} disabled={market.disabled} className={exchange===market.id?'active':''} onClick={()=>chooseExchange(market.id)}><img className={`market-${market.id.toLocaleLowerCase('tr')}`} src={`${import.meta.env.BASE_URL}markets/${market.logo}`} alt=""/><span>{market.name}</span><small>{market.note}</small></button>)}</section>}
    {step===symbolStep&&<section className="wizard-pane">{kind==='Para'&&<label className="monthly-balance-option"><span><b>Aylık dengemi varlıklarıma ekle</b><small>Bu ayın gelir ve gider farkı otomatik güncellenir.</small></span><span className="switch"><input type="checkbox" checked={monthlyEnabled} disabled={monthlyBusy} onChange={e=>void toggleMonthlyBalance(e.target.checked)}/><span/></span></label>}<label className="search asset-search"><Search/><input placeholder={`${kind==='Kıymetli Madenler'?'Madenler':kind} ara`} value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="symbol-results">{matches.slice(0,150).map(item=><button type="button" key={`${item.kind}-${item.exchange||'global'}-${item.dataSource||'yahoo'}-${item.symbol}`} className={selected===item?'active':''} onClick={()=>setSelected(item)}><b>{item.symbol}</b><span>{item.name}</span></button>)}</div>{matches.length>150&&<small className="result-limit">{matches.length.toLocaleString('tr-TR')} sonuç içinde arama yapabilirsin.</small>}</section>}
    {step===purchaseStep&&<section className="wizard-pane form-grid compact purchase-grid"><label className="full">Seçilen varlık<input className="selected-asset-input" readOnly aria-disabled="true" tabIndex={-1} value={selected?`${selected.symbol} - ${selected.name}`:''}/></label><label className="purchase-field">Alış tarihi<input required type="date" max={today} value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value>today?today:e.target.value)}/></label><label className="purchase-field">Alış fiyatı<div className="price-input"><input required type="number" min="0" step="any" value={price} onChange={e=>setPrice(e.target.value)}/><span className={priceCurrency==='₺'?'turkish-lira-symbol':undefined}>{priceCurrency}</span></div></label></section>}
    {step===unitsStep&&<section className="wizard-pane form-grid compact"><label className="full">Adet / miktar<input required type="number" min="0" step="any" value={units} onChange={e=>setUnits(e.target.value)}/></label><div className="asset-preview full"><b>{selected?.name}</b><span>{Number(units||0).toLocaleString('tr-TR')} adet · {price?trMoney.format(Number(price)):'-'}</span><strong>{trMoney.format(Number(units||0)*Number(price||0))}</strong></div></section>}
    <div className="form-actions full"><button type="button" onClick={step===0?clearAndClose:()=>setStep(step-1)}>{step===0?'Vazgeç':'Geri'}</button>{step<unitsStep?<button type="button" className="primary" disabled={(step===1&&hasExchangeStep&&!exchange)||(step===symbolStep&&!selected)||(step===purchaseStep&&(!price||busy))} onClick={()=>setStep(step+1)}>Devam</button>:<button className="primary" disabled={busy||!selected||!units||!price}>{busy?'Kaydediliyor...':'Kaydet'}</button>}</div>
  </form></Modal>
}
function Modal({title,close,children,locked=false,className=''}:{title:string;close:()=>void;children:React.ReactNode;locked?:boolean;className?:string}) { return <div className="modal-backdrop" onMouseDown={e=>!locked&&e.target===e.currentTarget&&close()}><section className={`modal ${className}`.trim()}><header><h2>{title}</h2>{!locked&&<button className="icon-button" onClick={close}><X/></button>}</header>{children}</section></div> }
function Empty({text}:{text:string}) { return <div className="empty"><WalletCards/><p>{text}</p></div> }
