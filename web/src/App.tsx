import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Turnstile } from '@marsidev/react-turnstile'
import { AreaChart, Area, BarChart, Bar, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Apple, ArrowDownUp, BarChart3, CalendarDays, ChevronRight, CircleDollarSign, LayoutDashboard, LogOut, Menu, Moon, Pencil, PieChart as PieIcon, Plus, Search, Settings, Sun, Tags, Trash2, WalletCards, X } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { Asset, Cadence, Category, defaultCategories, Entry, FlowKind } from './types'

type Page = 'dashboard' | 'transactions' | 'recurring' | 'assets' | 'settings'
const trMoney = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })
const trMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' })
const today = new Date().toISOString().slice(0, 10)
const nav = [
  { id: 'dashboard' as Page, label: 'Özet', icon: LayoutDashboard }, { id: 'transactions' as Page, label: 'Hareketler', icon: ArrowDownUp },
  { id: 'recurring' as Page, label: 'Düzenli', icon: CalendarDays }, { id: 'assets' as Page, label: 'Varlıklar', icon: WalletCards },
  { id: 'settings' as Page, label: 'Ayarlar', icon: Settings }
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, value) => setSession(value))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!authReady) return <div className="splash"><div className="brand-mark">₺</div><b>Harcamac</b></div>
  if (!session) return <Auth />
  return <FinanceApp session={session} />
}

function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [busy, setBusy] = useState(false)
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
  const redirectTo = `${window.location.origin}/`

  async function socialLogin(provider: 'google' | 'apple') {
    setBusy(true); setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
    if (error) { setMessage(error.message); setBusy(false) }
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    if (!isSupabaseConfigured) { setMessage('Supabase bağlantısı henüz yapılandırılmadı. .env dosyasını kontrol edin.'); setBusy(false); return }
    if (mode === 'signup' && password !== passwordAgain) { setMessage('Şifreler birbiriyle eşleşmiyor.'); setBusy(false); return }
    if (turnstileSiteKey && !captchaToken) { setMessage('Lütfen robot olmadığınızı doğrulayın.'); setBusy(false); return }
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captchaToken || undefined } })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: redirectTo, captchaToken: captchaToken || undefined } })
    setMessage(result.error?.message || (mode === 'signup' ? 'Doğrulama bağlantısı e-posta adresinize gönderildi. Gelen kutunuzu kontrol edin.' : ''))
    setBusy(false)
  }
  return <main className="auth-shell">
    <section className="auth-story"><div className="auth-brand"><span className="brand-mark">₺</span> Harcamac</div><div><h1>Paranızın nereye gittiğini bilin.</h1><p>Gelirlerinizi, harcamalarınızı ve varlıklarınızı sade bir ekranda takip edin.</p></div><small>Kişisel finans, daha sakin.</small></section>
    <section className="auth-panel"><form className="auth-form" onSubmit={submit}>
      <div><h2>{mode === 'login' ? 'Tekrar hoş geldiniz' : 'Hesabınızı oluşturun'}</h2><p>{mode === 'login' ? 'Devam etmek için giriş yapın.' : 'Finans takibinize birkaç saniyede başlayın.'}</p></div>
      {mode === 'signup' && <label>Ad soyad<input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>}
      <label>E-posta<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      <label>Şifre<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
      {mode === 'signup' && <label>Şifreyi doğrula<input required minLength={8} type="password" value={passwordAgain} onChange={e => setPasswordAgain(e.target.value)} autoComplete="new-password" /></label>}
      {turnstileSiteKey && <div className="turnstile-wrap"><Turnstile siteKey={turnstileSiteKey} options={{ language: 'tr', theme: 'auto' }} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken('')} onError={() => setCaptchaToken('')} /></div>}
      {message && <div className="form-message">{message}</div>}
      <button className="primary wide" disabled={busy}>{busy ? 'Bekleyin…' : mode === 'login' ? 'Giriş yap' : 'Üye ol'}</button>
      <div className="auth-divider"><span>veya</span></div>
      <div className="social-buttons"><button type="button" onClick={() => socialLogin('google')} disabled={busy}><span className="google-mark">G</span>Google ile devam et</button><button type="button" onClick={() => socialLogin('apple')} disabled={busy}><Apple/>Apple ile devam et</button></div>
      <button type="button" className="text-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setPasswordAgain(''); setCaptchaToken(''); setMessage('') }}>{mode === 'login' ? 'Hesabınız yok mu? Üye olun' : 'Zaten hesabınız var mı? Giriş yapın'}</button>
    </form></section>
  </main>
}

function FinanceApp({ session }: { session: Session }) {
  const [page, setPage] = useState<Page>('dashboard')
  const [entries, setEntries] = useState<Entry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [entryOpen, setEntryOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light')
  const userId = session.user.id

  async function loadData() {
    setLoading(true)
    const [e, c, a] = await Promise.all([
      supabase.from('entries').select('*, categories(name)').order('entry_date', { ascending: false }),
      supabase.from('categories').select('*').order('name'), supabase.from('assets').select('*').order('created_at', { ascending: false })
    ])
    setEntries((e.data || []).map((x: any) => ({ ...x, category_name: x.categories?.name || 'Diğer' })))
    let loadedCategories = (c.data || []) as Category[]
    if (!loadedCategories.length && !c.error) {
      const { data } = await supabase.from('categories').insert(defaultCategories.map(x => ({ ...x, user_id: userId }))).select()
      loadedCategories = (data || []) as Category[]
    }
    setCategories(loadedCategories); setAssets((a.data || []) as Asset[]); setLoading(false)
  }
  useEffect(() => { loadData() }, [userId])
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme) }, [theme])

  const title = nav.find(x => x.id === page)?.label
  return <div className="app-shell">
    <aside className="sidebar"><div className="logo"><span className="brand-mark">₺</span><span>Harcamac</span></div><nav>{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon /> <span>{item.label}</span></button>)}</nav><div className="sidebar-user"><div className="avatar">{(session.user.user_metadata.full_name || session.user.email || 'H')[0].toUpperCase()}</div><div><b>{session.user.user_metadata.full_name || 'Hesabım'}</b><small>{session.user.email}</small></div><button title="Çıkış yap" onClick={() => supabase.auth.signOut()}><LogOut /></button></div></aside>
    <main className="workspace"><header><div><span className="mobile-logo">Harcamac</span><h1>{title}</h1><p>{page === 'dashboard' ? 'Finansal durumunuza genel bakış' : page === 'transactions' ? 'Tüm gelir ve gider kayıtlarınız' : ''}</p></div><div className="header-actions">{page === 'transactions' && <button className="icon-button" title="Kategoriler" onClick={() => setCategoryOpen(true)}><Tags /></button>}<button className="primary" onClick={() => { setEditEntry(null); setEntryOpen(true) }}><Plus /> <span>Yeni hareket</span></button></div></header>
      {loading ? <div className="loading">Verileriniz getiriliyor…</div> : <>
        {page === 'dashboard' && <Dashboard entries={entries} assets={assets} />}
        {page === 'transactions' && <Transactions entries={entries} categories={categories} onEdit={e => { setEditEntry(e); setEntryOpen(true) }} onDelete={async id => { await supabase.from('entries').delete().eq('id', id); loadData() }} />}
        {page === 'recurring' && <Recurring entries={entries} onEdit={e => { setEditEntry(e); setEntryOpen(true) }} />}
        {page === 'assets' && <Assets assets={assets} userId={userId} reload={loadData} />}
        {page === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} email={session.user.email || ''} openCategories={() => setCategoryOpen(true)} />}
      </>}
    </main>
    <nav className="bottom-nav">{nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon/><span>{item.label}</span></button>)}</nav>
    {entryOpen && <EntryModal userId={userId} categories={categories} entry={editEntry} close={() => setEntryOpen(false)} saved={() => { setEntryOpen(false); loadData() }} />}
    {categoryOpen && <CategoryModal userId={userId} categories={categories} close={() => setCategoryOpen(false)} reload={loadData} />}
  </div>
}

function Dashboard({ entries, assets }: { entries: Entry[]; assets: Asset[] }) {
  const now = new Date(), current = entries.filter(e => { const d = new Date(e.entry_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const income = current.filter(e => e.kind === 'income').reduce((s,e) => s + Number(e.amount), 0)
  const expense = current.filter(e => e.kind === 'expense').reduce((s,e) => s + Number(e.amount), 0)
  const assetTotal = assets.reduce((s,a) => s + Number(a.units) * Number(a.current_price), 0)
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); const list = entries.filter(e => { const x = new Date(e.entry_date); return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear() }); return { name: d.toLocaleDateString('tr-TR',{month:'short'}), Gelir: list.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.amount),0), Gider: list.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.amount),0) } })
  const grouped = Object.values(current.filter(e=>e.kind==='expense').reduce((a,e) => { const key=e.category_name||'Diğer'; a[key] ||= {name:key,value:0}; a[key].value += Number(e.amount); return a }, {} as Record<string,{name:string,value:number}>))
  const colors = ['#dc5b4f','#e7a23d','#418a73','#477ea8','#8b69a8','#6b7c55']
  return <div className="page-content">
    <section className="metric-grid"><Metric label="Bu ay gelir" value={income} tone="green"/><Metric label="Bu ay gider" value={expense} tone="red"/><Metric label="Aylık denge" value={income-expense} tone="ink"/><Metric label="Toplam varlık" value={assetTotal} tone="blue"/></section>
    <section className="chart-grid"><article className="panel chart-wide"><PanelTitle title="Gelir ve gider akışı" subtitle="Son 6 ay" icon={<BarChart3/>}/><div className="chart"><ResponsiveContainer><BarChart data={months}><CartesianGrid vertical={false} stroke="#dfe2dc"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={(v:number)=>trMoney.format(v)}/><Bar dataKey="Gelir" fill="#3d8b68" radius={[4,4,0,0]}/><Bar dataKey="Gider" fill="#dc5b4f" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></article>
      <article className="panel"><PanelTitle title="Gider dağılımı" subtitle="Bu ay" icon={<PieIcon/>}/><div className="donut-wrap"><div className="donut"><ResponsiveContainer><PieChart><Pie data={grouped.length?grouped:[{name:'Veri yok',value:1}]} innerRadius="58%" outerRadius="82%" dataKey="value" stroke="none">{(grouped.length?grouped:[{}]).map((_,i)=><Cell key={i} fill={grouped.length?colors[i%colors.length]:'#e4e6e1'}/>)}</Pie><Tooltip formatter={(v:number)=>trMoney.format(v)}/></PieChart></ResponsiveContainer><div><b>{trMoney.format(expense)}</b><small>toplam</small></div></div><div className="legend">{grouped.slice(0,5).map((x,i)=><div key={x.name}><span style={{background:colors[i%colors.length]}}/>{x.name}<b>{expense?Math.round(x.value/expense*100):0}%</b></div>)}</div></div></article>
    </section>
    <section className="panel recent"><PanelTitle title="Son hareketler" subtitle="En yeni kayıtlar"/><EntryRows entries={entries.slice(0,5)}/></section>
  </div>
}
function Metric({label,value,tone}:{label:string;value:number;tone:string}) { return <article className={`metric ${tone}`}><small>{label}</small><b>{trMoney.format(value)}</b><span>{tone==='red'?'Aylık harcama':tone==='green'?'Aylık kazanç':'Güncel toplam'}</span></article> }
function PanelTitle({title,subtitle,icon}:{title:string;subtitle:string;icon?:React.ReactNode}) { return <div className="panel-title"><div>{icon}<span><b>{title}</b><small>{subtitle}</small></span></div><button className="icon-button subtle"><Menu/></button></div> }

function Transactions({ entries, categories, onEdit, onDelete }: { entries:Entry[];categories:Category[];onEdit:(e:Entry)=>void;onDelete:(id:string)=>void }) {
  const [query,setQuery]=useState(''), [kind,setKind]=useState<'all'|FlowKind>('all'), [cat,setCat]=useState('all'), [sort,setSort]=useState<'date'|'amount'>('date')
  const filtered=useMemo(()=>entries.filter(e=>(kind==='all'||e.kind===kind)&&(cat==='all'||e.category_id===cat)&&(e.title.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))||(e.category_name||'').toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))).sort((a,b)=>sort==='amount'?Number(b.amount)-Number(a.amount):b.entry_date.localeCompare(a.entry_date)),[entries,query,kind,cat,sort])
  const groups=Object.entries(filtered.reduce((a,e)=>{const key=trMonth.format(new Date(`${e.entry_date}T12:00:00`));(a[key]||=[]).push(e);return a},{} as Record<string,Entry[]>))
  return <div className="page-content"><div className="filters"><label className="search"><Search/><input placeholder="Hareket ara" value={query} onChange={e=>setQuery(e.target.value)}/></label><select value={kind} onChange={e=>setKind(e.target.value as any)}><option value="all">Tüm türler</option><option value="expense">Giderler</option><option value="income">Gelirler</option></select><select value={cat} onChange={e=>setCat(e.target.value)}><option value="all">Tüm kategoriler</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value as any)}><option value="date">Tarihe göre</option><option value="amount">Tutara göre</option></select></div>
    {groups.length?groups.map(([month,list])=><section className="transaction-group" key={month}><div className="month-title"><b>{month}</b><span>{list.length} hareket</span></div><div className="panel"><EntryRows entries={list} actions={{onEdit,onDelete}}/></div></section>):<Empty text="Henüz hareket bulunmuyor."/>}</div>
}
function EntryRows({entries,actions}:{entries:Entry[];actions?:{onEdit:(e:Entry)=>void;onDelete:(id:string)=>void}}){return <div className="entry-list">{entries.map(e=><div className="entry-row" key={e.id}><div className={`entry-icon ${e.kind}`}><CircleDollarSign/></div><div className="entry-main"><b>{e.title}</b><span>{e.category_name} · {new Date(`${e.entry_date}T12:00:00`).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}</span></div><div className={`entry-amount ${e.kind}`}><b>{e.kind==='expense'?'-':'+'}{trMoney.format(Number(e.amount))}</b><span>{e.cadence==='recurring'?'Düzenli':'Tek seferlik'}</span></div>{actions&&<div className="row-actions"><button title="Düzenle" onClick={()=>actions.onEdit(e)}><Pencil/></button><button className="danger" title="Sil" onClick={()=>confirm('Bu hareket silinsin mi?')&&actions.onDelete(e.id)}><Trash2/></button></div>}</div>)}</div>}

function Recurring({entries,onEdit}:{entries:Entry[];onEdit:(e:Entry)=>void}) { const list=entries.filter(e=>e.cadence==='recurring'); const inc=list.filter(e=>e.kind==='income').reduce((s,e)=>s+Number(e.amount),0), exp=list.filter(e=>e.kind==='expense').reduce((s,e)=>s+Number(e.amount),0); return <div className="page-content"><section className="metric-grid two"><Metric label="Düzenli gelir" value={inc} tone="green"/><Metric label="Düzenli gider" value={exp} tone="red"/></section><section className="panel"><PanelTitle title="Düzenli hareketler" subtitle="Aylık planınız"/><EntryRows entries={list} actions={{onEdit,onDelete:()=>{}}}/></section></div> }

function Assets({assets,userId,reload}:{assets:Asset[];userId:string;reload:()=>void}) { const [open,setOpen]=useState(false); return <div className="page-content"><div className="section-action"><div><h2>Varlık portföyü</h2><p>Nakit, altın, hisse ve diğer birikimleriniz.</p></div><button className="primary" onClick={()=>setOpen(true)}><Plus/>Varlık ekle</button></div><div className="asset-grid">{assets.map(a=><article className="panel asset" key={a.id}><small>{a.kind}</small><h3>{a.name}</h3><span>{a.units} {a.symbol}</span><b>{trMoney.format(Number(a.units)*Number(a.current_price))}</b><button className="danger-link" onClick={async()=>{await supabase.from('assets').delete().eq('id',a.id);reload()}}>Kaldır</button></article>)}{!assets.length&&<Empty text="Henüz varlık eklenmedi."/>}</div>{open&&<AssetModal userId={userId} close={()=>setOpen(false)} saved={()=>{setOpen(false);reload()}}/>}</div> }

function SettingsPage({theme,setTheme,email,openCategories}:{theme:'light'|'dark';setTheme:(x:'light'|'dark')=>void;email:string;openCategories:()=>void}) { return <div className="page-content settings-page"><section className="panel settings-list"><button onClick={()=>setTheme(theme==='light'?'dark':'light')}><span className="settings-icon">{theme==='light'?<Sun/>:<Moon/>}</span><span><b>Görünüm</b><small>{theme==='light'?'Açık tema':'Koyu tema'}</small></span><ChevronRight/></button><button onClick={openCategories}><span className="settings-icon"><Tags/></span><span><b>Kategoriler</b><small>Gelir ve gider kategorilerini yönetin</small></span><ChevronRight/></button><button onClick={()=>supabase.auth.signOut()}><span className="settings-icon"><LogOut/></span><span><b>Çış yap</b><small>{email}</small></span><ChevronRight/></button></section></div> }

function EntryModal({userId,categories,entry,close,saved}:{userId:string;categories:Category[];entry:Entry|null;close:()=>void;saved:()=>void}) {
  const [kind,setKind]=useState<FlowKind>(entry?.kind||'expense'), [cadence,setCadence]=useState<Cadence>(entry?.cadence||'one_time'), [title,setTitle]=useState(entry?.title||''), [amount,setAmount]=useState(entry?.amount?.toString()||''), [category,setCategory]=useState(entry?.category_id||''), [date,setDate]=useState(entry?.entry_date||today), [note,setNote]=useState(entry?.note||''), [installments,setInstallments]=useState(entry?.installment_count?.toString()||''), [busy,setBusy]=useState(false)
  const available=categories.filter(c=>c.kind===kind&&(cadence==='recurring'?c.recurring:c.one_time))
  useEffect(()=>{if(!available.some(c=>c.id===category))setCategory(available[0]?.id||'')},[kind,cadence,categories])
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);const payload={user_id:userId,title:title.trim(),amount:Number(amount.replace(',','.')),category_id:category||null,kind,cadence,entry_date:date,note:note.trim(),installment_count:kind==='expense'&&cadence==='recurring'&&Number(installments)>1?Number(installments):null,notification_enabled:false}; const result=entry?await supabase.from('entries').update(payload).eq('id',entry.id):await supabase.from('entries').insert(payload);setBusy(false);if(result.error)alert(result.error.message);else saved()}
  return <Modal title={entry?'Hareketi düzenle':'Harcama kaydı'} close={close}><form className="form-grid" onSubmit={submit}><div className="segment full"><button type="button" className={kind==='expense'?'active expense':''} onClick={()=>setKind('expense')}>Gider</button><button type="button" className={kind==='income'?'active income':''} onClick={()=>setKind('income')}>Gelir</button></div><label>Başlık<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Tutar<input required min="0.01" step="0.01" inputMode="decimal" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Tür<select value={cadence} onChange={e=>setCadence(e.target.value as Cadence)}><option value="one_time">Tek seferlik</option><option value="recurring">Düzenli</option></select></label><label>Kategori<select required value={category} onChange={e=>setCategory(e.target.value)}><option value="">Kategori seçin</option>{available.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Tarih<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{kind==='expense'&&cadence==='recurring'&&<label>Taksit sayısı<input type="number" inputMode="numeric" min="2" max="120" placeholder="Peşin için boş bırakın" value={installments} onChange={e=>setInstallments(e.target.value)}/></label>}<label className="full">Not<textarea maxLength={500} rows={3} value={note} onChange={e=>setNote(e.target.value)}/></label><div className="form-actions full"><button type="button" onClick={close}>Vazgeç</button><button className="primary" disabled={busy}>{busy?'Kaydediliyor…':'Kaydet'}</button></div></form></Modal>
}

function CategoryModal({userId,categories,close,reload}:{userId:string;categories:Category[];close:()=>void;reload:()=>void}) { const [name,setName]=useState(''),[color,setColor]=useState('#3f8f74'),[kind,setKind]=useState<FlowKind>('expense'),[one,setOne]=useState(true),[recurring,setRecurring]=useState(false); async function add(e:FormEvent){e.preventDefault();await supabase.from('categories').insert({user_id:userId,name:name.trim(),color,kind,one_time:one,recurring});setName('');reload()} return <Modal title="Kategoriler" close={close}><form className="category-add" onSubmit={add}><input required maxLength={60} placeholder="Kategori adı" value={name} onChange={e=>setName(e.target.value)}/><input aria-label="Kategori rengi" type="color" value={color} onChange={e=>setColor(e.target.value)}/><select value={kind} onChange={e=>setKind(e.target.value as FlowKind)}><option value="expense">Gider</option><option value="income">Gelir</option></select><label><input type="checkbox" checked={one} onChange={e=>setOne(e.target.checked)}/> Tek seferlik</label><label><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/> Düzenli</label><button className="primary" disabled={!one&&!recurring}><Plus/>Ekle</button></form><div className="category-list">{categories.map(c=><div key={c.id}><span className="color-dot" style={{background:c.color}}/><b>{c.name}</b><small>{c.kind==='income'?'Gelir':'Gider'} · {[c.one_time&&'Tek seferlik',c.recurring&&'Düzenli'].filter(Boolean).join(', ')}</small><button className="danger" title="Kategoriyi kaldır" onClick={async()=>{if(confirm('Kategori kaldırılsın mı?')){await supabase.from('categories').delete().eq('id',c.id);reload()}}}><Trash2/></button></div>)}</div></Modal> }

function AssetModal({userId,close,saved}:{userId:string;close:()=>void;saved:()=>void}) { const [name,setName]=useState(''),[symbol,setSymbol]=useState(''),[kind,setKind]=useState('Nakit'),[units,setUnits]=useState(''),[price,setPrice]=useState(''); async function submit(e:FormEvent){e.preventDefault();const {error}=await supabase.from('assets').insert({user_id:userId,name,symbol:symbol.toUpperCase(),kind,units:Number(units),average_cost:Number(price),current_price:Number(price)});if(error)alert(error.message);else saved()} return <Modal title="Varlık ekle" close={close}><form className="form-grid" onSubmit={submit}><label>Varlık adı<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Sembol<input maxLength={12} value={symbol} onChange={e=>setSymbol(e.target.value)}/></label><label>Tür<select value={kind} onChange={e=>setKind(e.target.value)}>{['Nakit','Banka','Hisse','Altın','Kripto','Diğer'].map(x=><option key={x}>{x}</option>)}</select></label><label>Adet / miktar<input required type="number" min="0" step="any" value={units} onChange={e=>setUnits(e.target.value)}/></label><label>Güncel birim fiyat<input required type="number" min="0" step="any" value={price} onChange={e=>setPrice(e.target.value)}/></label><div className="form-actions full"><button type="button" onClick={close}>Vazgeç</button><button className="primary">Kaydet</button></div></form></Modal> }
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}) { return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><section className="modal"><header><h2>{title}</h2><button className="icon-button" onClick={close}><X/></button></header>{children}</section></div> }
function Empty({text}:{text:string}) { return <div className="empty"><WalletCards/><p>{text}</p></div> }
