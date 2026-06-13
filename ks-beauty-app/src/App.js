import React, { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "./firebase";

const SK="ks_v6";
const ld=()=>{try{return JSON.parse(localStorage.getItem(SK)||"{}");}catch{return{};}};
const sv=(d)=>{try{localStorage.setItem(SK,JSON.stringify(d));return true;}catch(e){return false;}};
const PHOTO_SK="ks_photos_v1";
const ldPhotos=()=>{try{return JSON.parse(localStorage.getItem(PHOTO_SK)||"{}");}catch{return{};}};
const svPhotos=(d)=>{try{localStorage.setItem(PHOTO_SK,JSON.stringify(d));return true;}catch(e){return false;}};
function getClientPhotos(id){return ldPhotos()[id]||[];}
function saveClientPhotos(id,photos){const all=ldPhotos();all[id]=photos;return svPhotos(all);}

function compressImage(file,maxW=600,quality=0.65){
  return new Promise((resolve)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement("canvas");
        let w=img.width,h=img.height;
        if(w>maxW){h=Math.round(h*(maxW/w));w=maxW;}
        canvas.width=w;canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL("image/jpeg",quality));
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const CAT_DEFAULT=[
  {id:"eclat_express",nom:"Eclat Express",duree:"30 min",prix:"20 000 F",categorie:"Soins Visage",couleur:"#4fc3c3"},
  {id:"anti_taches",nom:"Anti-Taches Signature",duree:"1h00",prix:"35 000 F",categorie:"Soins Visage",couleur:"#f0a500"},
  {id:"vitamin_c_glow",nom:"Vitamin C Glow",duree:"1h15",prix:"40 000 F",categorie:"Soins Visage",couleur:"#7e57c2"},
  {id:"night_repair_luxe",nom:"Night Repair Luxe",duree:"1h30",prix:"50 000 F",categorie:"Soins Visage",couleur:"#e57373"},
  {id:"dermaplaning",nom:"Dermaplaning (add-on)",duree:"+15 min",prix:"+5 000 F",categorie:"Option Add-On",couleur:"#81c784"},
  {id:"diagnostic_peau",nom:"Diagnostic de Peau",duree:"20 min",prix:"10 000 F",categorie:"Service Boutique",couleur:"#64b5f6"},
];
const CATEGORIES=["Soins Visage","Option Add-On","Service Boutique","Pedicure","Manucure"];
const PALETTE=["#4fc3c3","#f0a500","#7e57c2","#e57373","#81c784","#64b5f6","#f06292","#ffb74d","#a1887f","#8b5e52"];
const TYPES_PEAU=["Normale","Seche","Grasse","Mixte","Sensible","Deshydratee","Mature","A tendance acneique"];
const PROBLEMATIQUES=["Acne","Points noirs","Taches","Rides","Secheresse","Deshydratation","Brillance","Sensibilite","Cernes","Pores dilates","Teint terne","Rougeurs","Hyperpigmentation","Relachement"];
const EMPTY_FORM={prenom:"",nom:"",telephone:"",email:"",dateNaissance:"",typesPeau:[],allergies:"",traitementsEnCours:"",problematiquesPeau:[],soins:[],produitsUtilises:"",notes:"",dateVisite:toIso(new Date()),seances:0};
const ADRESSE="K's Make Up Addict, 7eme Tranche, en face des 2 stations Shell, Abidjan";
const MAPS_LINK="https://maps.app.goo.gl/hNbSzDaM3YeJmfo19";
const PHONE_STUDIO="2250584913471";
const PIN_DEFAULT="1234";

function getBadge(s){
  if(s>=20)return{label:"Diamant",bg:"#e8d5f5",color:"#6a1b9a"};
  if(s>=10)return{label:"VIP",bg:"#fff3cd",color:"#856404"};
  if(s>=5)return{label:"Fidele",bg:"#fdecea",color:"#8b5e52"};
  return null;
}

const MOIS=["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
const MOIS_COURT=["janv.","fevr.","mars","avr.","mai","juin","juil.","aout","sept.","oct.","nov.","dec."];
const JOURS=["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];
function toIso(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function parseDate(s){const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function startOfWeek(d){const r=new Date(d);const day=r.getDay();r.setDate(r.getDate()-(day===0?6:day-1));return r;}
function isToday(iso){return iso===toIso(new Date());}
function isTomorrow(iso){return iso===toIso(addDays(new Date(),1));}
function formatDateFR(iso){const d=parseDate(iso);return`${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;}
function isBirthdayThisWeek(dn){
  if(!dn)return false;const p=dn.split("-");if(p.length<3)return false;
  const ws=startOfWeek(new Date());
  for(let i=0;i<7;i++){const d=addDays(ws,i);if(d.getDate()===parseInt(p[2])&&d.getMonth()===parseInt(p[1])-1)return true;}
  return false;
}

function buildWa(rdv,client,catalogue){
  const ids=rdv.soins?.length?rdv.soins:(rdv.soin?[rdv.soin]:[]);
  const soins=ids.map(id=>catalogue.find(s=>s.id===id)).filter(Boolean);
  const dateLabel=isToday(rdv.date)?"Aujourd'hui":isTomorrow(rdv.date)?"Demain":formatDateFR(rdv.date);
  const msg="Bonjour "+(client?.prenom||rdv.nomLibre||"")+", nous vous rappelons que vous avez rendez-vous chez K's Make Up Addict.\n\nDate et heure\n"+dateLabel+" a "+rdv.heure+"\n\nPrestations reservees\n"+soins.map(s=>s.nom.toUpperCase()+" ("+s.duree+")").join("\n")+"\n\nAdresse\n"+ADRESSE+"\n"+MAPS_LINK;
  const tel=(client?.telephone||rdv.tel||"").replace(/\D/g,"");
  const dest=tel?(tel.startsWith("225")?tel:"225"+tel):PHONE_STUDIO;
  return"https://wa.me/"+dest+"?text="+encodeURIComponent(msg);
}
function buildFideliteWa(c){
  const msg="Bonjour "+c.prenom+" ! Felicitations, vous avez atteint "+c.seances+" seances chez K's Beauty Studio !\nEn signe de fidelite, votre prochaine seance beneficie d'une remise speciale.\nMerci pour votre confiance !\n- K's Make Up Addict\n"+MAPS_LINK;
  const tel=(c.telephone||"").replace(/\D/g,"");
  const dest=tel?(tel.startsWith("225")?tel:"225"+tel):PHONE_STUDIO;
  return"https://wa.me/"+dest+"?text="+encodeURIComponent(msg);
}

export default function App(){
  const stored=ld();
  const [unlocked,setUnlocked]=useState(false);
  const [savedPin,setSavedPin]=useState(stored.pin||PIN_DEFAULT);
  if(!unlocked)return React.createElement(PinScreen,{savedPin,onUnlock:()=>setUnlocked(true)});
  return React.createElement(MainApp,{savedPin,setSavedPin:(np)=>{setSavedPin(np);sv({...ld(),pin:np});}});
}

function PinScreen({savedPin,onUnlock}){
  const [pin,setPin]=useState("");
  const [err,setErr]=useState(false);
  const digits=["1","2","3","4","5","6","7","8","9","","0","X"];
  useEffect(()=>{
    if(pin.length===4){
      if(pin===savedPin){onUnlock();}
      else{setErr(true);setTimeout(()=>{setPin("");setErr(false);},700);}
    }
  },[pin]);
  return(
    <div className="ks-app" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"0 20px"}}>
      <div style={{fontFamily:"Georgia,serif",fontSize:"clamp(22px,6vw,32px)",color:"#8b5e52",marginBottom:4,textAlign:"center"}}>K's Beauty Studio</div>
      <div style={{fontSize:13,color:"#b5938a",marginBottom:40,letterSpacing:1}}>Espace equipe</div>
      <div style={{display:"flex",gap:14,marginBottom:32}}>
        {[0,1,2,3].map(i=>(<div key={i} style={{width:16,height:16,borderRadius:8,background:err?"#9b2335":i<pin.length?"#8b5e52":"#e8d5d0",transition:"background 0.2s"}}/>))}
      </div>
      {err&&<div style={{color:"#9b2335",fontSize:13,marginBottom:16}}>Code incorrect</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,width:"min(260px,80vw)"}}>
        {digits.map((d,i)=>(
          <button key={i} onClick={()=>{
            if(d==="")return;
            if(d==="X"){setPin(p=>p.slice(0,-1));return;}
            if(pin.length<4)setPin(p=>p+d);
          }} style={{height:64,borderRadius:16,border:"1px solid #f0ddd8",background:d===""?"transparent":"#fff",fontSize:d==="X"?16:22,color:"#3a2a27",cursor:d===""?"default":"pointer"}}>
            {d==="X"?"⌫":d}
          </button>
        ))}
      </div>
      <div style={{fontSize:11,color:"#c9a79e",marginTop:30}}>Code par defaut : 1234</div>
    </div>
  );
}

function MainApp({savedPin,setSavedPin}){
  const [clients,setClients]=useState([]);
  const [rdvs,setRdvs]=useState([]);
  const [catalogue,setCatalogue]=useState(CAT_DEFAULT);
  const [attente,setAttente]=useState([]);
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState("list");
  const [form,setForm]=useState(EMPTY_FORM);
  const [editId,setEditId]=useState(null);
  const [selected,setSelected]=useState(null);
  const [rdvForm,setRdvForm]=useState(null);
  const [soinForm,setSoinForm]=useState(null);
  const [search,setSearch]=useState("");
  const [filterSoin,setFilterSoin]=useState("");
  const [toast,setToast]=useState(null);
  const [agendaMode,setAgendaMode]=useState("mois");
  const [selDay,setSelDay]=useState(()=>toIso(new Date()));
  const [moisRef,setMoisRef]=useState(()=>new Date());
  const [noteRdvId,setNoteRdvId]=useState(null);
  const [noteText,setNoteText]=useState("");
  const now=new Date();

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"clients"),snap=>{setClients(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    const u2=onSnapshot(collection(db,"rdvs"),snap=>setRdvs(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(collection(db,"catalogue"),snap=>{const items=snap.docs.map(d=>({id:d.id,...d.data()}));if(items.length>0)setCatalogue(items);});
    const u4=onSnapshot(collection(db,"attente"),snap=>setAttente(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();u4();};
  },[]);
  const persist=()=>{};
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};
  if(loading)return(<div className="ks-app" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><div style={{textAlign:"center"}}><div style={{fontSize:28,color:"#8b5e52",marginBottom:12}}>K's Beauty Studio</div><div style={{color:"#c9a79e",fontSize:14}}>Chargement...</div></div></div>);
  const soinColor=(id)=>catalogue.find(x=>x.id===id)?.couleur||"#8b5e52";

  const saveClient=async()=>{
    if(!form.prenom.trim()||!form.nom.trim()){showToast("Prenom et nom requis","error");return;}
    try{
      const id=editId||"c_"+Date.now();
      await setDoc(doc(db,"clients",id),{...form,id,seances:editId?(clients.find(c=>c.id===editId)?.seances||0):0});
      showToast(editId?"Fiche mise a jour":"Fiche enregistree");
      setView("list");setForm(EMPTY_FORM);setEditId(null);
    }catch(e){showToast("Erreur reseau","error");}
  };
  const deleteClient=async(id)=>{
    if(!window.confirm("Supprimer cette fiche ?"))return;
    try{
      await deleteDoc(doc(db,"clients",id));
      await Promise.all(rdvs.filter(r=>r.clientId===id).map(r=>deleteDoc(doc(db,"rdvs",r.id))));
      const photos=ldPhotos();delete photos[id];svPhotos(photos);
      showToast("Fiche supprimee");setView("list");
    }catch(e){showToast("Erreur reseau","error");}
  };
  const addSeance=async(clientId)=>{
    try{await updateDoc(doc(db,"clients",clientId),{seances:increment(1)});showToast("Seance ajoutee");}
    catch(e){showToast("Erreur reseau","error");}
  };
  const removeSeance=async(clientId)=>{
    try{await updateDoc(doc(db,"clients",clientId),{seances:increment(-1)});showToast("Seance retiree");}
    catch(e){showToast("Erreur reseau","error");}
  };
  const saveRdv=async(r)=>{
    let nc=clients;let rdvF={...r};
    if(!r.clientId&&r.nomLibre?.trim()){
      const parts=r.nomLibre.trim().split(" ");
      const prenom=parts[0]||"";const nom=parts.slice(1).join(" ")||prenom;
      const newId="c_"+Date.now();
      await setDoc(doc(db,"clients",newId),{...EMPTY_FORM,id:newId,prenom,nom,telephone:r.tel||"",dateVisite:r.date,seances:0});
      rdvF={...rdvF,clientId:newId,nomLibre:"",tel:""};
      showToast("Fiche creee pour "+r.nomLibre);
    }
    try{
      const id=rdvF.id||"r_"+Date.now();
      await setDoc(doc(db,"rdvs",id),{...rdvF,id});
      if(!r.nomLibre?.trim())showToast("RDV enregistre");
      if(selected&&rdvF.clientId===selected.id)setView("detail");else setView("agenda");
      setRdvForm(null);
    }catch(e){showToast("Erreur reseau","error");}
  };
  const deleteRdv=async(id)=>{
    const rdv=rdvs.find(r=>r.id===id);
    try{
      const rdv=rdvs.find(r=>r.id===id);
      if(rdv?.effectue&&rdv?.clientId)await updateDoc(doc(db,"clients",rdv.clientId),{seances:increment(-1)});
      await deleteDoc(doc(db,"rdvs",id));
      showToast("RDV supprime");
    }catch(e){showToast("Erreur reseau","error");}
  };
  const validerRdv=async(rdv)=>{
    try{
      await updateDoc(doc(db,"rdvs",rdv.id),{effectue:true});
      if(rdv.clientId)await updateDoc(doc(db,"clients",rdv.clientId),{seances:increment(1)});
      showToast("Seance validee");
    }catch(e){showToast("Erreur reseau","error");}
  };
  const saveNote=async(rdvId,note)=>{
    try{
      await updateDoc(doc(db,"rdvs",rdvId),{noteSeance:note});
      setNoteRdvId(null);setNoteText("");showToast("Note enregistree");
    }catch(e){showToast("Erreur reseau","error");}
  };
  const saveSoin=async(s)=>{
    try{
      const id=s.id||"soin_"+Date.now();
      await setDoc(doc(db,"catalogue",id),{...s,id});
      showToast(s.id?"Modifie":"Ajoute");setView("catalogue");setSoinForm(null);
    }catch(e){showToast("Erreur reseau","error");}
  };
  const deleteSoin=async(id)=>{
    try{await deleteDoc(doc(db,"catalogue",id));showToast("Supprime");}
    catch(e){showToast("Erreur reseau","error");}
  };
  const addAttente=async(a)=>{
    try{
      const id="a_"+Date.now();
      await setDoc(doc(db,"attente",id),{...a,id,date:toIso(now)});
      showToast("Ajoutee a la liste d'attente");
    }catch(e){showToast("Erreur reseau","error");}
  };
  const removeAttente=async(id)=>{
    try{await deleteDoc(doc(db,"attente",id));showToast("Retiree");}
    catch(e){showToast("Erreur reseau","error");}
  };

  // Stats
  const moisIso=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const rdvsMois=rdvs.filter(r=>r.date?.startsWith(moisIso)&&r.effectue);
  const revenus=rdvsMois.reduce((acc,r)=>{
    (r.soins?.length?r.soins:(r.soin?[r.soin]:[])).forEach(id=>{const s=catalogue.find(x=>x.id===id);if(s?.prix){const n=parseInt(s.prix.replace(/\D/g,""));if(!isNaN(n))acc+=n;}});
    return acc;
  },0);
  const soinCount={};
  rdvs.filter(r=>r.effectue).forEach(r=>{(r.soins?.length?r.soins:(r.soin?[r.soin]:[])).forEach(id=>{soinCount[id]=(soinCount[id]||0)+1;});});
  const topSoin=Object.entries(soinCount).sort((a,b)=>b[1]-a[1])[0];
  const topSoinNom=topSoin?catalogue.find(s=>s.id===topSoin[0])?.nom:"—";
  const anniversaires=clients.filter(c=>isBirthdayThisWeek(c.dateNaissance));
  const rdvsDemain=rdvs.filter(r=>isTomorrow(r.date));

  const toggle=(field,val)=>setForm(f=>({...f,[field]:f[field].includes(val)?f[field].filter(x=>x!==val):[...f[field],val]}));
  const initials=c=>`${(c.prenom||"?")[0]}${(c.nom||"?")[0]}`.toUpperCase();
  let filtered=[...clients].filter(c=>`${c.prenom} ${c.nom}`.toLowerCase().includes(search.toLowerCase())||(c.telephone||"").includes(search));
  if(filterSoin)filtered=filtered.filter(c=>c.soins?.includes(filterSoin));
  filtered.sort((a,b)=>a.nom.localeCompare(b.nom));

  // Grille mois
  const firstDay=new Date(moisRef.getFullYear(),moisRef.getMonth(),1);
  const totalDays=new Date(moisRef.getFullYear(),moisRef.getMonth()+1,0).getDate();
  const startDow=firstDay.getDay()===0?6:firstDay.getDay()-1;
  const calCells=[];
  for(let i=0;i<startDow;i++)calCells.push(null);
  for(let d=1;d<=totalDays;d++)calCells.push(new Date(moisRef.getFullYear(),moisRef.getMonth(),d));
  while(calCells.length%7!==0)calCells.push(null);

  // Creneaux
  const CRENEAUX=[];
  for(let h=8;h<20;h++)for(let m=0;m<60;m+=30)CRENEAUX.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);

  const navItems=[["list","Clients","👤"],["agenda","Agenda","📅"],["catalogue","Soins","💆"],["attente","Attente","⏳"],["stats","Stats","📊"],["settings","Reglages","⚙️"]];

  return(
    <div className="ks-app">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      {toast&&<div style={{position:"fixed",top:18,left:"50%",transform:"translateX(-50%)",color:"#fff",padding:"10px 20px",borderRadius:20,fontSize:14,zIndex:200,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.18)",background:toast.type==="error"?"#9b2335":"#2d6a4f",maxWidth:"90vw",overflow:"hidden",textOverflow:"ellipsis"}}>{toast.msg}</div>}

      {noteRdvId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:"#fff",width:"100%",maxWidth:600,borderRadius:"20px 20px 0 0",padding:"20px 18px 40px"}}>
            <div style={{fontSize:18,color:"#8b5e52",marginBottom:12,fontWeight:500}}>Note de seance</div>
            <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} rows={5} placeholder="Produits utilises, reactions, recommandations..." style={{width:"100%",border:"1px solid #e8d5d0",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#3a2a27",resize:"none",lineHeight:1.6}}/>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>{setNoteRdvId(null);setNoteText("");}} style={S.btnCancel}>Annuler</button>
              <button onClick={()=>saveNote(noteRdvId,noteText)} style={S.btnSave}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {navItems.map(([v])=>v).includes(view)&&(
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:600,background:"#fff",borderTop:"1px solid #f0ddd8",display:"flex",zIndex:50,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
          {navItems.map(([v,label,icon])=>(
            <button key={v} onClick={()=>setView(v)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"7px 0 9px",background:"none",border:"none",color:view===v?"#8b5e52":"#c9a79e",position:"relative",cursor:"pointer"}}>
              <span style={{fontSize:17}}>{icon}</span>
              <span style={{fontSize:9,marginTop:2,fontWeight:500}}>{label}</span>
              {v==="attente"&&attente.length>0&&<span style={{position:"absolute",top:4,right:"50%",transform:"translateX(10px)",background:"#9b2335",color:"#fff",fontSize:8,width:13,height:13,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}>{attente.length}</span>}
            </button>
          ))}
        </div>
      )}

      {/* LIST */}
      {view==="list"&&(
        <div style={{paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Clients</h1></div>
            <button style={S.btnRound} onClick={()=>{setEditId(null);setForm({...EMPTY_FORM,dateVisite:toIso(now)});setView("form");}}>+</button>
          </div>
          {rdvsDemain.length>0&&(
            <div style={{margin:"8px 14px 4px",background:"#fff3cd",borderRadius:12,padding:"10px 14px",border:"1px solid #f0a500"}}>
              <div style={{fontSize:12,fontWeight:500,color:"#856404",marginBottom:6}}>Rappels a envoyer — RDV demain</div>
              {rdvsDemain.map(r=>{
                const client=clients.find(c=>c.id===r.clientId);
                const nom=client?`${client.prenom} ${client.nom}`:r.nomLibre||"Client";
                return(<div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,color:"#3a2a27"}}>{nom} a {r.heure}</span>
                  <a href={buildWa(r,client,catalogue)} target="_blank" style={{background:"#25D366",color:"#fff",padding:"3px 10px",borderRadius:10,fontSize:12,fontWeight:500}}>Rappel</a>
                </div>);
              })}
            </div>
          )}
          {anniversaires.length>0&&(
            <div style={{margin:"6px 14px 4px",background:"#fff8f5",borderRadius:12,padding:"10px 14px",border:"1px solid #f0ddd8"}}>
              <div style={{fontSize:12,fontWeight:500,color:"#8b5e52",marginBottom:4}}>Anniversaire cette semaine</div>
              {anniversaires.map(c=><div key={c.id} style={{fontSize:13,color:"#3a2a27"}}>{c.prenom} {c.nom}</div>)}
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",margin:"8px 14px 6px",background:"#fff",borderRadius:12,border:"1px solid #e8d5d0",padding:"0 12px"}}>
            <input style={{flex:1,border:"none",background:"none",padding:"10px 0",fontSize:15,color:"#3a2a27"}} placeholder="Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&<button style={{background:"none",border:"none",color:"#b5938a",fontSize:14,cursor:"pointer"}} onClick={()=>setSearch("")}>X</button>}
          </div>
          <div style={{padding:"0 14px 8px",display:"flex",gap:6,overflowX:"auto"}}>
            <button onClick={()=>setFilterSoin("")} style={{padding:"4px 12px",borderRadius:20,fontSize:12,border:!filterSoin?"1.5px solid #8b5e52":"1px solid #e8d5d0",background:!filterSoin?"#8b5e52":"#fff",color:!filterSoin?"#fff":"#8b5e52",whiteSpace:"nowrap",flexShrink:0,cursor:"pointer"}}>Tous</button>
            {catalogue.map(s=><button key={s.id} onClick={()=>setFilterSoin(filterSoin===s.id?"":s.id)} style={{padding:"4px 12px",borderRadius:20,fontSize:12,border:filterSoin===s.id?`1.5px solid ${s.couleur}`:"1px solid #e8d5d0",background:filterSoin===s.id?s.couleur:"#fff",color:filterSoin===s.id?"#fff":"#8b5e52",whiteSpace:"nowrap",flexShrink:0,cursor:"pointer"}}>{s.nom}</button>)}
          </div>
          {filtered.length===0?(
            <div style={{textAlign:"center",padding:40,color:"#c9a79e"}}>
              {clients.length===0?<><div style={{fontSize:36,marginBottom:10}}>+</div><div style={{fontSize:20,color:"#b5938a"}}>Aucun client</div><div style={{fontSize:13,marginTop:6}}>Appuyez sur + pour commencer</div></>:<div>Aucun resultat</div>}
            </div>
          ):(
            <div style={{padding:"4px 14px 20px",display:"flex",flexDirection:"column",gap:8}}>
              {filtered.map(c=>{
                const badge=getBadge(c.seances||0);
                return(
                  <button key={c.id} style={{display:"flex",alignItems:"center",background:"#fff",borderRadius:14,padding:"12px",border:"1px solid #f0ddd8",textAlign:"left",width:"100%",gap:10,cursor:"pointer"}} onClick={()=>{setSelected(c);setView("detail");}}>
                    <div style={{width:44,height:44,borderRadius:22,background:"linear-gradient(135deg,#e8c4bb,#c9896e)",color:"#fff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:500}}>{initials(c)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <div style={{fontSize:15,fontWeight:500,color:"#3a2a27",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"55%"}}>{c.prenom} {c.nom}</div>
                        {badge&&<span style={{fontSize:10,background:badge.bg,color:badge.color,padding:"1px 7px",borderRadius:10,fontWeight:500,flexShrink:0}}>{badge.label}</span>}
                        {isBirthdayThisWeek(c.dateNaissance)&&<span style={{fontSize:12,flexShrink:0}}>Birthday</span>}
                      </div>
                      <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
                        {(c.seances||0)>0&&<span style={{background:"#d8f0e7",color:"#2d6a4f",fontSize:11,padding:"1px 8px",borderRadius:10}}>{c.seances} seance{c.seances>1?"s":""}</span>}
                        {c.telephone&&<span style={{color:"#b5938a",fontSize:12}}>{c.telephone}</span>}
                      </div>
                    </div>
                    <div style={{fontSize:11,color:"#c9a79e",flexShrink:0}}>{c.dateVisite||""}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DETAIL */}
      {view==="detail"&&selected&&(()=>{
        const fc=clients.find(c=>c.id===selected.id)||selected;
        const clientRdvs=rdvs.filter(r=>r.clientId===fc.id).sort((a,b)=>b.date.localeCompare(a.date));
        const badge=getBadge(fc.seances||0);
        const next=[5,10,20].find(m=>m>(fc.seances||0));
        return(
          <div style={{paddingBottom:20}}>
            <div style={S.header}>
              <button style={S.backBtn} onClick={()=>setView("list")}>Retour</button>
              <div style={{display:"flex",gap:8}}>
                <button style={S.btnSmall} onClick={()=>{setEditId(fc.id);setForm({...EMPTY_FORM,...fc});setView("form");}}>Modifier</button>
                <button style={{...S.btnSmall,background:"#fdecea",color:"#9b2335"}} onClick={()=>deleteClient(fc.id)}>Supprimer</button>
              </div>
            </div>
            <div style={{padding:"20px 20px 14px",textAlign:"center",borderBottom:"1px solid #f0ddd8"}}>
              <div style={{width:68,height:68,borderRadius:34,background:"linear-gradient(135deg,#e8c4bb,#c9896e)",color:"#fff",fontSize:26,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px",fontWeight:500}}>{initials(fc)}</div>
              <h2 style={{fontSize:"clamp(20px,5vw,24px)",color:"#3a2a27",margin:"0 0 6px",fontWeight:600}}>{fc.prenom} {fc.nom}</h2>
              <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:6}}>
                {fc.typesPeau?.map(t=><span key={t} style={{background:"#fdecea",color:"#8b5e52",fontSize:11,padding:"2px 8px",borderRadius:10}}>{t}</span>)}
                {badge&&<span style={{fontSize:11,background:badge.bg,color:badge.color,padding:"2px 10px",borderRadius:10,fontWeight:500}}>{badge.label}</span>}
              </div>
            </div>
            <SeanceBox fc={fc} badge={badge} addSeance={addSeance} removeSeance={removeSeance}/>
            {next&&(
              <div style={{padding:"8px 18px",background:"#fdf8f6",borderBottom:"1px solid #f0ddd8"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#b5938a",marginBottom:4}}>
                  <span>Vers {next} seances</span><span>{fc.seances||0}/{next}</span>
                </div>
                <div style={{height:6,background:"#f0ddd8",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"linear-gradient(90deg,#8b5e52,#c9896e)",borderRadius:3,width:`${Math.min(100,((fc.seances||0)/next)*100)}%`}}/>
                </div>
              </div>
            )}
            <div style={{padding:"8px 18px 40px"}}>
              {[["Tel",fc.telephone],["Email",fc.email],["Naissance",fc.dateNaissance],["Derniere visite",fc.dateVisite],["Allergies",fc.allergies],["Traitements",fc.traitementsEnCours],["Produits",fc.produitsUtilises],["Notes",fc.notes]].map(([l,v])=>v?<div key={l} style={{marginBottom:12,paddingBottom:10,borderBottom:"1px solid #f5ede9"}}><div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:3}}>{l}</div><div style={{fontSize:15,color:"#3a2a27"}}>{v}</div></div>:null)}
              {fc.soins?.length>0&&<div style={{marginBottom:12,paddingBottom:10,borderBottom:"1px solid #f5ede9"}}><div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:4}}>Soins habituels</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{fc.soins.map(s=><span key={s} style={{background:"#d8f0e7",color:"#2d6a4f",fontSize:12,padding:"2px 8px",borderRadius:10}}>{catalogue.find(x=>x.id===s)?.nom||s}</span>)}</div></div>}
              {fc.problematiquesPeau?.length>0&&<div style={{marginBottom:12,paddingBottom:10,borderBottom:"1px solid #f5ede9"}}><div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:4}}>Problematiques</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{fc.problematiquesPeau.map(p=><span key={p} style={{background:"#f0ddd8",color:"#6b3f35",fontSize:12,padding:"2px 8px",borderRadius:10}}>{p}</span>)}</div></div>}
              <PhotoSection clientId={fc.id} showToast={showToast}/>
              {clientRdvs.length>0&&(
                <div style={{marginBottom:14,paddingBottom:12,borderBottom:"1px solid #f5ede9"}}>
                  <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:8}}>Historique RDV</div>
                  {clientRdvs.map(r=>{
                    const ids=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
                    const soinsH=ids.map(id=>catalogue.find(s=>s.id===id)).filter(Boolean);
                    return(
                      <div key={r.id} style={{padding:"8px 0",borderBottom:"1px solid #fdecea"}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                              <span style={{fontWeight:500,color:"#3a2a27",fontSize:13}}>{r.date} a {r.heure}</span>
                              {r.effectue&&<span style={{fontSize:10,background:"#d8f0e7",color:"#2d6a4f",padding:"1px 7px",borderRadius:10}}>Effectue</span>}
                            </div>
                            {soinsH.map(s=><div key={s.id} style={{fontSize:12,color:"#8b5e52",marginTop:1}}>{s.nom}</div>)}
                            {r.noteSeance&&<div style={{fontSize:11,color:"#3a2a27",background:"#fdf8f6",borderRadius:6,padding:"4px 8px",marginTop:4,border:"1px solid #f0ddd8"}}>{r.noteSeance}</div>}
                          </div>
                          <div style={{display:"flex",flexDirection:"row",gap:4,flexShrink:0,alignItems:"center"}}>
                            {!r.effectue&&<button style={S.iconBtn} title="Valider" onClick={()=>validerRdv(r)}>✓</button>}
                            <button style={S.iconBtn} title="Note" onClick={()=>{setNoteRdvId(r.id);setNoteText(r.noteSeance||"");}}>📝</button>
                            <a href={buildWa(r,fc,catalogue)} target="_blank" style={{...S.iconBtn,background:"#25D366",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}} title="WhatsApp">📲</a>
                            <button style={S.iconBtn} title="Modifier" onClick={()=>{setRdvForm({...r});setView("rdvForm");}}>✏️</button>
                            <button style={{...S.iconBtn,background:"#fdecea",color:"#9b2335"}} title="Supprimer" onClick={()=>deleteRdv(r.id)}>🗑</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button style={{...S.saveBtn,background:"linear-gradient(135deg,#2d6a4f,#52b788)"}} onClick={()=>{setRdvForm({clientId:fc.id,date:toIso(now),heure:"09:00",soins:[],note:""});setView("rdvForm");}}>
                Prendre un RDV pour {fc.prenom}
              </button>
            </div>
          </div>
        );
      })()}

      {/* FORM CLIENT */}
      {view==="form"&&(
        <div>
          <div style={S.header}>
            <button style={S.backBtn} onClick={()=>{setView("list");setEditId(null);setForm(EMPTY_FORM);}}>Annuler</button>
            <div style={S.brandTag}>{editId?"Modifier":"Nouvelle fiche"}</div>
          </div>
          <div style={{padding:"16px 18px",paddingBottom:80}}>
            <Sect title="Identite">
              <TwoCol><Fld label="Prenom *" value={form.prenom} onChange={v=>setForm(f=>({...f,prenom:v}))}/><Fld label="Nom *" value={form.nom} onChange={v=>setForm(f=>({...f,nom:v}))}/></TwoCol>
              <Fld label="Telephone" value={form.telephone} onChange={v=>setForm(f=>({...f,telephone:v}))} type="tel"/>
              <Fld label="Email" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} type="email"/>
              <TwoCol>
                <Fld label="Date de naissance" value={form.dateNaissance} onChange={v=>setForm(f=>({...f,dateNaissance:v}))} type="date"/>
                <Fld label="Date de visite" value={form.dateVisite} onChange={v=>setForm(f=>({...f,dateVisite:v}))} type="date"/>
              </TwoCol>
            </Sect>
            <Sect title="Type de peau"><Chips items={TYPES_PEAU} selected={form.typesPeau} onToggle={v=>toggle("typesPeau",v)}/></Sect>
            <Sect title="Problematiques"><Chips items={PROBLEMATIQUES} selected={form.problematiquesPeau} onToggle={v=>toggle("problematiquesPeau",v)}/></Sect>
            <Sect title="Soins habituels"><SoinsSelector selected={form.soins} onToggle={v=>toggle("soins",v)} catalogue={catalogue}/></Sect>
            <Sect title="Infos">
              <Fld label="Allergies" value={form.allergies} onChange={v=>setForm(f=>({...f,allergies:v}))} multiline/>
              <Fld label="Traitements en cours" value={form.traitementsEnCours} onChange={v=>setForm(f=>({...f,traitementsEnCours:v}))} multiline/>
              <Fld label="Produits utilises" value={form.produitsUtilises} onChange={v=>setForm(f=>({...f,produitsUtilises:v}))} multiline/>
              <Fld label="Notes" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} multiline/>
            </Sect>
            <button style={S.saveBtn} onClick={saveClient}>{editId?"Mettre a jour":"Enregistrer"}</button>
          </div>
        </div>
      )}

      {/* AGENDA */}
      {view==="agenda"&&(
        <div style={{paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Agenda</h1></div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{display:"flex",background:"#f0ddd8",borderRadius:20,padding:2}}>
                {[["mois","Mois"],["semaine","Sem."],["jour","Jour"]].map(([m,l])=>(
                  <button key={m} onClick={()=>setAgendaMode(m)} style={{padding:"4px 9px",borderRadius:18,border:"none",background:agendaMode===m?"#8b5e52":"transparent",color:agendaMode===m?"#fff":"#8b5e52",fontSize:11,fontWeight:500,cursor:"pointer"}}>{l}</button>
                ))}
              </div>
              <button style={S.btnRound} onClick={()=>{setRdvForm({clientId:"",nomLibre:"",tel:"",date:selDay,heure:"09:00",soins:[],note:""});setView("rdvForm");}}>+</button>
            </div>
          </div>

          {/* VUE MOIS — style Google Calendar */}
          {agendaMode==="mois"&&(
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 18px 6px"}}>
                <button style={S.weekNavBtn} onClick={()=>setMoisRef(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}>{"<"}</button>
                <div style={{fontSize:18,color:"#3a2a27",fontWeight:600}}>{MOIS[moisRef.getMonth()]} {moisRef.getFullYear()}</div>
                <button style={S.weekNavBtn} onClick={()=>setMoisRef(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}>{">"}</button>
              </div>
              {/* En-têtes jours */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 6px 4px",borderBottom:"1px solid #f0ddd8"}}>
                {["lun.","mar.","mer.","jeu.","ven.","sam.","dim."].map((j,i)=>(
                  <div key={i} style={{textAlign:"center",fontSize:10,color:"#c9a79e",fontWeight:600,padding:"3px 0"}}>{j}</div>
                ))}
              </div>
              {/* Grille semaines */}
              <div style={{padding:"0 6px 8px"}}>
                {Array.from({length:calCells.length/7},(_,wi)=>(
                  <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid #f5ede9",minHeight:70}}>
                    {calCells.slice(wi*7,(wi+1)*7).map((d,di)=>{
                      if(!d)return <div key={di} style={{borderRight:"1px solid #f5ede9",background:"#faf7f5"}}/>;
                      const iso=toIso(d);
                      const rdvsDay=rdvs.filter(r=>r.date===iso).sort((a,b)=>a.heure.localeCompare(b.heure));
                      const today=isToday(iso);
                      const isSel=iso===selDay;
                      return(
                        <div key={di} style={{borderRight:"1px solid #f5ede9",padding:"3px 2px",cursor:"pointer",background:isSel?"#fdf0ec":"transparent",minHeight:70}} onClick={()=>{setSelDay(iso);setAgendaMode("semaine");}}>
                          {/* Numéro du jour */}
                          <div style={{display:"flex",justifyContent:"center",marginBottom:2}}>
                            <div style={{width:22,height:22,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:today?700:400,background:today?"#8b5e52":"transparent",color:today?"#fff":isSel?"#8b5e52":"#3a2a27"}}>
                              {d.getDate()}
                            </div>
                          </div>
                          {/* RDVs du jour */}
                          {rdvsDay.slice(0,2).map(r=>{
                            const ids=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
                            const color=soinColor(ids[0]);
                            const client=clients.find(c=>c.id===r.clientId);
                            const nom=client?client.prenom:r.nomLibre?.split(" ")[0]||"?";
                            return(
                              <div key={r.id} style={{background:color,borderRadius:4,padding:"1px 4px",marginBottom:2,overflow:"hidden",opacity:r.effectue?0.7:1}}
                                onClick={e=>{e.stopPropagation();setSelDay(iso);setAgendaMode("semaine");}}>
                                <div style={{fontSize:9,color:"#fff",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.4}}>{r.heure} {nom}</div>
                              </div>
                            );
                          })}
                          {rdvsDay.length>2&&<div style={{fontSize:8,color:"#8b5e52",paddingLeft:2,fontWeight:600}}>+{rdvsDay.length-2} autre{rdvsDay.length-2>1?"s":""}</div>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VUE SEMAINE — grille horaire style Google Calendar */}
          {agendaMode==="semaine"&&(()=>{
            const ws=startOfWeek(parseDate(selDay));
            const weekDays=Array.from({length:7},(_,i)=>addDays(ws,i));
            const HOURS=Array.from({length:12},(_,i)=>i+8); // 8h à 19h
            return(
              <div style={{overflowX:"auto"}}>
                {/* Navigation semaine */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 14px"}}>
                  <button style={S.weekNavBtn} onClick={()=>setSelDay(toIso(addDays(parseDate(selDay),-7)))}> {"<"} </button>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:13,fontWeight:500,color:"#3a2a27"}}>{MOIS_COURT[ws.getMonth()]} {ws.getFullYear()}</div>
                    <div style={{fontSize:11,color:"#b5938a"}}>{ws.getDate()} – {addDays(ws,6).getDate()} {MOIS_COURT[addDays(ws,6).getMonth()]}</div>
                  </div>
                  <button style={S.weekNavBtn} onClick={()=>setSelDay(toIso(addDays(parseDate(selDay),7)))}> {">"} </button>
                </div>
                {/* En-tête jours */}
                <div style={{display:"grid",gridTemplateColumns:"36px repeat(7,1fr)",borderBottom:"1px solid #f0ddd8",padding:"0 4px"}}>
                  <div/>
                  {weekDays.map((d,i)=>{
                    const iso=toIso(d);const today=isToday(iso);
                    return(
                      <div key={iso} style={{textAlign:"center",padding:"4px 2px",cursor:"pointer"}} onClick={()=>setSelDay(iso)}>
                        <div style={{fontSize:9,color:today?"#8b5e52":"#c9a79e",fontWeight:600,textTransform:"uppercase"}}>{["lun","mar","mer","jeu","ven","sam","dim"][i]}</div>
                        <div style={{width:24,height:24,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:today?700:400,background:today?"#8b5e52":"transparent",color:today?"#fff":"#3a2a27",margin:"2px auto 0"}}>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Grille horaire */}
                <div style={{overflowY:"auto",maxHeight:"calc(100vh - 220px)",padding:"0 4px 20px"}}>
                  {HOURS.map(h=>{
                    const hStr=`${String(h).padStart(2,"0")}:00`;
                    const hStr30=`${String(h).padStart(2,"0")}:30`;
                    const isNowH=isToday(toIso(new Date()))&&new Date().getHours()===h;
                    return(
                      <div key={h}>
                        {/* Ligne heure pleine */}
                        <div style={{display:"grid",gridTemplateColumns:"36px repeat(7,1fr)",minHeight:40,borderBottom:"1px solid #f5ede9"}}>
                          <div style={{fontSize:10,color:isNowH?"#8b5e52":"#c9a79e",paddingTop:2,textAlign:"right",paddingRight:6,fontWeight:isNowH?600:400}}>{hStr}</div>
                          {weekDays.map((d,i)=>{
                            const iso=toIso(d);
                            const rdvsSlot=rdvs.filter(r=>r.date===iso&&r.heure===hStr);
                            return(
                              <div key={i} style={{borderLeft:"1px solid #f5ede9",padding:"1px 2px",minHeight:40,position:"relative",background:isToday(iso)?"#fdfaf8":"transparent"}}
                                onClick={()=>{setRdvForm({clientId:"",nomLibre:"",tel:"",date:iso,heure:hStr,soins:[],note:""});setView("rdvForm");}}>
                                {rdvsSlot.map(r=>{
                                  const ids=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
                                  const color=soinColor(ids[0]);
                                  const client=clients.find(c=>c.id===r.clientId);
                                  const nom=client?client.prenom:r.nomLibre?.split(" ")[0]||"?";
                                  const soin=catalogue.find(s=>s.id===ids[0]);
                                  return(
                                    <div key={r.id}
                                      onClick={e=>{e.stopPropagation();setRdvForm({...r});setView("rdvForm");}}
                                      style={{background:color,borderRadius:4,padding:"2px 4px",marginBottom:1,cursor:"pointer",opacity:r.effectue?0.7:1}}>
                                      <div style={{fontSize:9,color:"#fff",fontWeight:700,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.heure} {nom}</div>
                                      {soin&&<div style={{fontSize:8,color:"rgba(255,255,255,0.85)",lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{soin.nom}</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                        {/* Ligne demi-heure */}
                        <div style={{display:"grid",gridTemplateColumns:"36px repeat(7,1fr)",minHeight:40,borderBottom:"1px solid #faf5f2"}}>
                          <div style={{fontSize:10,color:"#e8d5d0",paddingTop:2,textAlign:"right",paddingRight:6}}>{hStr30}</div>
                          {weekDays.map((d,i)=>{
                            const iso=toIso(d);
                            const rdvsSlot=rdvs.filter(r=>r.date===iso&&r.heure===hStr30);
                            return(
                              <div key={i} style={{borderLeft:"1px solid #f5ede9",padding:"1px 2px",minHeight:40,background:isToday(iso)?"#fdfaf8":"transparent"}}
                                onClick={()=>{setRdvForm({clientId:"",nomLibre:"",tel:"",date:iso,heure:hStr30,soins:[],note:""});setView("rdvForm");}}>
                                {rdvsSlot.map(r=>{
                                  const ids=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
                                  const color=soinColor(ids[0]);
                                  const client=clients.find(c=>c.id===r.clientId);
                                  const nom=client?client.prenom:r.nomLibre?.split(" ")[0]||"?";
                                  const soin=catalogue.find(s=>s.id===ids[0]);
                                  return(
                                    <div key={r.id}
                                      onClick={e=>{e.stopPropagation();setRdvForm({...r});setView("rdvForm");}}
                                      style={{background:color,borderRadius:4,padding:"2px 4px",marginBottom:1,cursor:"pointer",opacity:r.effectue?0.7:1}}>
                                      <div style={{fontSize:9,color:"#fff",fontWeight:700,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.heure} {nom}</div>
                                      {soin&&<div style={{fontSize:8,color:"rgba(255,255,255,0.85)",lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{soin.nom}</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* VUE JOUR */}
          {agendaMode==="jour"&&(
            <div style={{padding:"8px 14px 80px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <button style={S.weekNavBtn} onClick={()=>setSelDay(toIso(addDays(parseDate(selDay),-1)))}> {"<"} </button>
                <div style={{flex:1,textAlign:"center",fontSize:13,fontWeight:500,color:"#3a2a27"}}>{formatDateFR(selDay)}</div>
                <button style={S.weekNavBtn} onClick={()=>setSelDay(toIso(addDays(parseDate(selDay),1)))}> {">"} </button>
              </div>
              {CRENEAUX.map(creneau=>{
                const rdvsC=rdvs.filter(r=>r.date===selDay&&r.heure===creneau);
                const isNow=isToday(selDay)&&creneau===`${String(now.getHours()).padStart(2,"0")}:${now.getMinutes()<30?"00":"30"}`;
                return(
                  <div key={creneau} style={{display:"flex",gap:8,marginBottom:2}}>
                    <div style={{width:38,fontSize:11,color:isNow?"#8b5e52":"#c9a79e",fontWeight:isNow?600:400,paddingTop:8,flexShrink:0,textAlign:"right"}}>{creneau}</div>
                    <div style={{flex:1,borderTop:`1px solid ${isNow?"#8b5e52":"#f0ddd8"}`,paddingTop:4,minHeight:34}}>
                      {rdvsC.length===0?(
                        <button onClick={()=>{setRdvForm({clientId:"",nomLibre:"",tel:"",date:selDay,heure:creneau,soins:[],note:""});setView("rdvForm");}} style={{width:"100%",height:28,background:"transparent",border:"none",cursor:"pointer"}}/>
                      ):rdvsC.map(r=>{
                        const client=clients.find(c=>c.id===r.clientId);
                        const ids=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
                        const color=soinColor(ids[0]);
                        const soin=catalogue.find(s=>s.id===ids[0]);
                        return(
                          <div key={r.id} style={{background:color+"18",borderLeft:`3px solid ${color}`,borderRadius:"0 8px 8px 0",padding:"6px 10px",marginBottom:4,opacity:r.effectue?0.75:1}}>
                            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6}}>
                              <div style={{flex:1,minWidth:0}}>
                                <button onClick={()=>{if(client){setSelected(client);setView("detail");}}} style={{background:"none",border:"none",padding:0,cursor:client?"pointer":"default",textAlign:"left"}}>
                                  <div style={{fontSize:13,fontWeight:600,color}}>{client?`${client.prenom} ${client.nom}`:r.nomLibre||"Client"}</div>
                                </button>
                                {soin&&<div style={{fontSize:11,color:"#8b5e52",marginTop:1}}>{soin.nom} · {soin.duree}</div>}
                                {r.effectue&&<div style={{fontSize:9,color:"#2d6a4f",fontWeight:600,marginTop:2}}>✓ Effectué</div>}
                                {r.noteSeance&&<div style={{fontSize:10,color:"#b5938a",marginTop:2,fontStyle:"italic"}}>📝 {r.noteSeance.substring(0,40)}{r.noteSeance.length>40?"...":""}</div>}
                              </div>
                              <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center"}}>
                                {!r.effectue&&<button onClick={()=>validerRdv(r)} title="Valider" style={{width:24,height:24,borderRadius:12,border:"none",background:color,color:"#fff",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✓</button>}
                                <button onClick={()=>{setNoteRdvId(r.id);setNoteText(r.noteSeance||"");}} title="Note" style={{width:24,height:24,borderRadius:12,border:"none",background:"#f0ddd8",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>📝</button>
                                <a href={buildWa(r,client,catalogue)} target="_blank" title="WhatsApp" style={{width:24,height:24,borderRadius:12,background:"#25D366",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>📲</a>
                                <button onClick={()=>{setRdvForm({...r});setView("rdvForm");}} title="Modifier" style={{width:24,height:24,borderRadius:12,border:"none",background:"#f0ddd8",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
                                <button onClick={()=>deleteRdv(r.id)} title="Supprimer" style={{width:24,height:24,borderRadius:12,border:"none",background:"#fdecea",color:"#9b2335",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CATALOGUE */}
      {view==="catalogue"&&(
        <div style={{paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Soins</h1></div>
            <button style={S.btnRound} onClick={()=>{setSoinForm({nom:"",duree:"",prix:"",categorie:"Soins Visage",couleur:"#8b5e52"});setView("soinForm");}}>+</button>
          </div>
          <div style={{padding:"8px 14px 20px"}}>
            {CATEGORIES.map(cat=>{
              const items=catalogue.filter(s=>s.categorie===cat);
              if(!items.length)return null;
              return(
                <div key={cat} style={{marginBottom:20}}>
                  <div style={{fontSize:11,color:"#c9a79e",letterSpacing:1,textTransform:"uppercase",marginBottom:8,fontWeight:500}}>{cat}</div>
                  {items.map(s=>(
                    <div key={s.id} style={{display:"flex",alignItems:"center",background:"#fff",borderRadius:12,padding:"11px",border:"1px solid #f0ddd8",gap:8,marginBottom:8,borderLeft:`3px solid ${s.couleur||"#8b5e52"}`}}>
                      <div style={{flex:1}}><div style={{fontSize:15,fontWeight:500,color:"#3a2a27"}}>{s.nom}</div><div style={{fontSize:12,color:"#b5938a",marginTop:2}}>{s.duree} - {s.prix}</div></div>
                      <button style={S.iconBtn} title="Modifier" onClick={()=>{setSoinForm({...s});setView("soinForm");}}>✏️</button>
                      <button style={{...S.iconBtn,background:"#fdecea",color:"#9b2335"}} title="Supprimer" onClick={()=>{if(window.confirm("Supprimer ?"))deleteSoin(s.id);}}>🗑</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FORM SOIN */}
      {view==="soinForm"&&soinForm&&(
        <div>
          <div style={S.header}>
            <button style={S.backBtn} onClick={()=>{setView("catalogue");setSoinForm(null);}}>Annuler</button>
            <div style={S.brandTag}>{soinForm.id?"Modifier":"Nouveau soin"}</div>
          </div>
          <div style={{padding:"16px 18px",paddingBottom:60}}>
            <Fld label="Nom *" value={soinForm.nom} onChange={v=>setSoinForm(f=>({...f,nom:v}))}/>
            <TwoCol>
              <Fld label="Duree" value={soinForm.duree} onChange={v=>setSoinForm(f=>({...f,duree:v}))}/>
              <Fld label="Prix" value={soinForm.prix} onChange={v=>setSoinForm(f=>({...f,prix:v}))}/>
            </TwoCol>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:5}}>Categorie</div>
              <select value={soinForm.categorie} onChange={e=>setSoinForm(f=>({...f,categorie:e.target.value}))} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fdf8f6",fontSize:15,color:"#3a2a27"}}>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:8}}>Couleur</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                {PALETTE.map(c=><button key={c} onClick={()=>setSoinForm(f=>({...f,couleur:c}))} style={{width:34,height:34,borderRadius:17,background:c,border:soinForm.couleur===c?"3px solid #3a2a27":"2px solid transparent",cursor:"pointer"}}/>)}
              </div>
            </div>
            <button style={{...S.saveBtn,opacity:soinForm.nom?.trim()?1:0.5}} disabled={!soinForm.nom?.trim()} onClick={()=>saveSoin(soinForm)}>{soinForm.id?"Mettre a jour":"Ajouter"}</button>
          </div>
        </div>
      )}

      {/* ATTENTE */}
      {view==="attente"&&(
        <div style={{paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Liste d'attente</h1></div>
          </div>
          <div style={{padding:"8px 14px 20px"}}>
            <AttenteForm clients={clients} catalogue={catalogue} onAdd={addAttente}/>
            {attente.length===0?<div style={{textAlign:"center",padding:"30px 0",color:"#c9a79e",fontSize:15}}>Aucune cliente en attente</div>:
              attente.map(a=>{
                const client=clients.find(c=>c.id===a.clientId);
                const nom=client?`${client.prenom} ${client.nom}`:a.nomLibre||"Client";
                const soin=catalogue.find(s=>s.id===a.soinId);
                return(
                  <div key={a.id} style={{display:"flex",alignItems:"flex-start",background:"#fff",borderRadius:12,padding:"11px",border:"1px solid #f0ddd8",gap:8,marginBottom:8,borderLeft:"3px solid #f0a500"}}>
                    <div style={{flex:1}}>
                      <button onClick={()=>{if(client){setSelected(client);setView("detail");}}} style={{background:"none",border:"none",padding:0,cursor:client?"pointer":"default",textAlign:"left"}}>
                        <div style={{fontSize:15,fontWeight:500,color:client?"#8b5e52":"#3a2a27"}}>{nom}</div>
                      </button>
                      {soin&&<div style={{fontSize:12,color:"#8b5e52",marginTop:2}}>{soin.nom}</div>}
                      {a.note&&<div style={{fontSize:11,color:"#c9a79e",marginTop:2}}>{a.note}</div>}
                    </div>
                    <button onClick={()=>{setRdvForm({clientId:a.clientId||"",nomLibre:a.nomLibre||"",tel:"",date:toIso(now),heure:"09:00",soins:a.soinId?[a.soinId]:[],note:""});removeAttente(a.id);setView("rdvForm");}} style={{padding:"5px 10px",borderRadius:10,border:"none",background:"#d8f0e7",color:"#2d6a4f",fontSize:12,fontWeight:500,cursor:"pointer",flexShrink:0}}>RDV</button>
                    <button style={{...S.iconBtn,background:"#fdecea",color:"#9b2335",flexShrink:0}} title="Supprimer" onClick={()=>removeAttente(a.id)}>🗑</button>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* STATS */}
      {view==="stats"&&(
        <div style={{paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Statistiques</h1></div>
          </div>
          <div style={{padding:"16px 14px"}}>
            <div style={{fontSize:12,color:"#b5938a",fontWeight:500,marginBottom:12,textTransform:"uppercase"}}>{MOIS[now.getMonth()]} {now.getFullYear()}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[["Seances ce mois",rdvsMois.length,""],["Revenus estimes",revenus.toLocaleString()+" F",""],["Clientes total",clients.length,""],["En attente",attente.length,""]].map(([label,value])=>(
                <div key={label} style={{background:"#fff",borderRadius:12,padding:"14px",border:"1px solid #f0ddd8",textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:600,color:"#3a2a27"}}>{value}</div>
                  <div style={{fontSize:11,color:"#b5938a",marginTop:4}}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{background:"#fff",borderRadius:14,padding:"14px",border:"1px solid #f0ddd8",marginBottom:12}}>
              <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:8}}>SOIN LE PLUS POPULAIRE</div>
              <div style={{fontSize:18,color:"#3a2a27",fontWeight:600}}>{topSoinNom}</div>
              {topSoin&&<div style={{fontSize:12,color:"#c9a79e",marginTop:3}}>{topSoin[1]} seance{topSoin[1]>1?"s":""}</div>}
            </div>
            {clients.filter(c=>(c.seances||0)>=5).length>0&&(
              <div style={{background:"#fff",borderRadius:14,padding:"14px",border:"1px solid #f0ddd8",marginBottom:12}}>
                <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:8}}>CLIENTES FIDELES</div>
                {clients.filter(c=>(c.seances||0)>=5).sort((a,b)=>(b.seances||0)-(a.seances||0)).map(c=>{
                  const badge=getBadge(c.seances||0);
                  return(
                    <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f5ede9"}}>
                      <button onClick={()=>{setSelected(c);setView("detail");}} style={{background:"none",border:"none",padding:0,cursor:"pointer"}}>
                        <span style={{fontSize:14,color:"#8b5e52"}}>{c.prenom} {c.nom}</span>
                      </button>
                      <div style={{display:"flex",gap:6}}>
                        <span style={{fontSize:11,background:badge.bg,color:badge.color,padding:"1px 8px",borderRadius:10}}>{badge.label}</span>
                        <a href={buildFideliteWa(c)} target="_blank" style={{fontSize:11,background:"#d8f0e7",color:"#2d6a4f",padding:"1px 8px",borderRadius:10}}>Cadeau</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {anniversaires.length>0&&(
              <div style={{background:"#fff8f5",borderRadius:14,padding:"14px",border:"1px solid #f0ddd8"}}>
                <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:8}}>ANNIVERSAIRES CETTE SEMAINE</div>
                {anniversaires.map(c=>(
                  <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}>
                    <span style={{fontSize:14,color:"#3a2a27"}}>{c.prenom} {c.nom}</span>
                    <span style={{fontSize:12,color:"#c9a79e"}}>{c.dateNaissance}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {view==="settings"&&<SettingsView savedPin={savedPin} setSavedPin={setSavedPin} showToast={showToast} setView={setView}/>}

      {/* FORM RDV */}
      {view==="rdvForm"&&rdvForm!=null&&(
        <RdvFormView rdvForm={rdvForm} clients={clients} catalogue={catalogue} onSave={saveRdv}
          onBack={()=>{if(selected&&rdvForm.clientId===selected.id)setView("detail");else setView("agenda");setRdvForm(null);}}/>
      )}
    </div>
  );
}

function SeanceBox({fc,badge,addSeance,removeSeance}){
  const ADMIN_CODE="1987";
  const [adminMode,setAdminMode]=useState(false);
  const [pinInput,setPinInput]=useState("");
  const [showPin,setShowPin]=useState(false);
  const [err,setErr]=useState(false);
  const digits=["1","2","3","4","5","6","7","8","9","","0","X"];
  useEffect(()=>{
    if(pinInput.length===4){
      if(pinInput===ADMIN_CODE){setAdminMode(true);setShowPin(false);setPinInput("");setErr(false);}
      else{setErr(true);setTimeout(()=>{setPinInput("");setErr(false);},700);}
    }
  },[pinInput]);
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",background:"#fff8f5",borderBottom:"1px solid #f0ddd8"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:6}}>
          <span style={{fontSize:36,color:"#8b5e52",fontWeight:600,lineHeight:1}}>{fc.seances||0}</span>
          <span style={{fontSize:13,color:"#b5938a"}}>seance{(fc.seances||0)!==1?"s":""}</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {badge&&fc.telephone&&<a href={buildFideliteWa(fc)} target="_blank" style={{padding:"6px 12px",borderRadius:16,background:"linear-gradient(135deg,#8b5e52,#c9896e)",color:"#fff",fontSize:12,fontWeight:500}}>Fidelite</a>}
          {adminMode?(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={()=>removeSeance(fc.id)} style={{width:36,height:36,borderRadius:18,border:"1.5px solid #9b2335",background:"#fff",color:"#9b2335",fontSize:22,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
              <button onClick={()=>addSeance(fc.id)} style={{width:36,height:36,borderRadius:18,border:"1.5px solid #2d6a4f",background:"#fff",color:"#2d6a4f",fontSize:22,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
              <button onClick={()=>setAdminMode(false)} style={{fontSize:10,color:"#c9a79e",background:"none",border:"none",cursor:"pointer",padding:"4px"}}>Quitter</button>
            </div>
          ):(
            <button onClick={()=>setShowPin(true)} style={{fontSize:11,color:"#c9a79e",background:"none",border:"1px solid #e8d5d0",borderRadius:12,padding:"4px 10px",cursor:"pointer"}}>Admin</button>
          )}
        </div>
      </div>
      {showPin&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:20,padding:"24px 20px",width:"min(300px,90vw)",textAlign:"center"}}>
            <div style={{fontSize:15,color:"#8b5e52",fontWeight:600,marginBottom:6}}>Mode Admin</div>
            <div style={{fontSize:12,color:"#b5938a",marginBottom:20}}>Entre le code admin pour modifier les seances</div>
            <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:20}}>
              {[0,1,2,3].map(i=><div key={i} style={{width:14,height:14,borderRadius:7,background:err?"#9b2335":i<pinInput.length?"#8b5e52":"#e8d5d0",transition:"background 0.2s"}}/>)}
            </div>
            {err&&<div style={{color:"#9b2335",fontSize:12,marginBottom:10}}>Code incorrect</div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:220,margin:"0 auto 16px"}}>
              {digits.map((d,i)=>(
                <button key={i} onClick={()=>{
                  if(d==="")return;
                  if(d==="X"){setPinInput(p=>p.slice(0,-1));return;}
                  if(pinInput.length<4)setPinInput(p=>p+d);
                }} style={{height:48,borderRadius:12,border:"1px solid #f0ddd8",background:d===""?"transparent":"#fff",fontSize:18,color:"#3a2a27",cursor:d===""?"default":"pointer"}}>
                  {d==="X"?"⌫":d}
                </button>
              ))}
            </div>
            <button onClick={()=>{setShowPin(false);setPinInput("");setErr(false);}} style={{color:"#b5938a",background:"none",border:"none",fontSize:13,cursor:"pointer"}}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoSection({clientId,showToast}){
  const fileRef=useRef();
  const [label,setLabel]=useState("Avant");
  const [preview,setPreview]=useState(null);
  const [loading,setLoading]=useState(false);
  const [photos,setPhotos]=useState(()=>getClientPhotos(clientId));

  const handleFile=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    setLoading(true);
    try{const compressed=await compressImage(file,600,0.65);setPreview(compressed);}
    catch{showToast("Erreur photo","error");}
    setLoading(false);e.target.value="";
  };
  const confirmAdd=()=>{
    if(!preview)return;
    const photo={id:"p_"+Date.now(),url:preview,label,date:toIso(new Date())};
    const updated=[...photos,photo];
    if(!saveClientPhotos(clientId,updated)){showToast("Stockage plein","error");return;}
    setPhotos(updated);setPreview(null);setLabel("Avant");showToast("Photo ajoutee");
  };
  const deletePhoto=(photoId)=>{
    const updated=photos.filter(p=>p.id!==photoId);
    saveClientPhotos(clientId,updated);setPhotos(updated);showToast("Photo supprimee");
  };
  return(
    <div style={{marginBottom:14,paddingBottom:12,borderBottom:"1px solid #f5ede9"}}>
      <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:8}}>Photos suivi</div>
      {photos.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
          {photos.map(p=>(
            <div key={p.id} style={{position:"relative"}}>
              <img src={p.url} alt={p.label} style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:8,display:"block"}}/>
              <div style={{fontSize:9,color:"#8b5e52",textAlign:"center",marginTop:2}}>{p.label}</div>
              <button onClick={()=>deletePhoto(p.id)} style={{position:"absolute",top:2,right:2,width:16,height:16,borderRadius:8,border:"none",background:"rgba(155,35,53,0.85)",color:"#fff",fontSize:9,cursor:"pointer"}}>X</button>
            </div>
          ))}
        </div>
      )}
      {loading&&<div style={{textAlign:"center",color:"#b5938a",fontSize:13,padding:"8px 0"}}>Compression...</div>}
      {preview&&!loading&&(
        <div>
          <img src={preview} style={{width:"100%",maxHeight:180,objectFit:"cover",borderRadius:10,marginBottom:8,display:"block"}}/>
          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
            {["Avant","Apres","Pendant","Resultat"].map(l=><button key={l} onClick={()=>setLabel(l)} style={{padding:"4px 10px",borderRadius:20,fontSize:12,border:label===l?"1.5px solid #8b5e52":"1px solid #e8d5d0",background:label===l?"#8b5e52":"#fff",color:label===l?"#fff":"#8b5e52",cursor:"pointer"}}>{l}</button>)}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setPreview(null)} style={S.btnCancel}>Annuler</button>
            <button onClick={confirmAdd} style={S.btnSave}>Enregistrer</button>
          </div>
        </div>
      )}
      {!preview&&!loading&&<button onClick={()=>fileRef.current.click()} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:10,border:"1px dashed #c9a79e",background:"#fdf8f6",color:"#8b5e52",fontSize:13,width:"100%",justifyContent:"center",cursor:"pointer"}}>+ Ajouter une photo</button>}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile}/>
    </div>
  );
}

function AttenteForm({clients,catalogue,onAdd}){
  const [open,setOpen]=useState(false);
  const [f,setF]=useState({clientId:"",nomLibre:"",soinId:"",note:""});
  if(!open)return<button onClick={()=>setOpen(true)} style={{width:"100%",padding:"11px",borderRadius:12,border:"1px dashed #c9a79e",background:"#fdf8f6",color:"#8b5e52",fontSize:14,marginBottom:12,cursor:"pointer"}}>+ Ajouter a la liste d'attente</button>;
  return(
    <div style={{background:"#fff",borderRadius:12,border:"1px solid #e8d5d0",padding:"14px",marginBottom:14}}>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:4}}>Cliente existante</div>
        <select value={f.clientId} onChange={e=>setF(p=>({...p,clientId:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fdf8f6",fontSize:14,color:"#3a2a27"}}>
          <option value="">Selectionner</option>
          {[...clients].sort((a,b)=>a.nom.localeCompare(b.nom)).map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
        </select>
      </div>
      {!f.clientId&&<Fld label="Ou nom libre" value={f.nomLibre} onChange={v=>setF(p=>({...p,nomLibre:v}))}/>}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:4}}>Soin souhaite</div>
        <select value={f.soinId} onChange={e=>setF(p=>({...p,soinId:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fdf8f6",fontSize:14,color:"#3a2a27"}}>
          <option value="">Selectionner</option>
          {catalogue.map(s=><option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
      </div>
      <Fld label="Note" value={f.note} onChange={v=>setF(p=>({...p,note:v}))} multiline/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setOpen(false)} style={S.btnCancel}>Annuler</button>
        <button onClick={()=>{if(!f.clientId&&!f.nomLibre.trim())return;onAdd(f);setOpen(false);setF({clientId:"",nomLibre:"",soinId:"",note:""}); }} style={S.btnSave}>Ajouter</button>
      </div>
    </div>
  );
}

function SettingsView({savedPin,setSavedPin,showToast,setView}){
  const [step,setStep]=useState("menu");
  const [old,setOld]=useState("");
  const [nw,setNw]=useState("");
  const [conf,setConf]=useState("");
  const [err,setErr]=useState("");
  const reset=()=>{setStep("menu");setOld("");setNw("");setConf("");setErr("");};
  function PI({value,setValue,label,onComplete}){
    useEffect(()=>{if(value.length===4&&onComplete)onComplete(value);},[value]);
    const digits=["1","2","3","4","5","6","7","8","9","","0","X"];
    return(
      <div>
        <div style={{fontSize:13,color:"#8b5e52",textAlign:"center",marginBottom:16,fontWeight:500}}>{label}</div>
        <div style={{display:"flex",gap:14,justifyContent:"center",marginBottom:24}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:14,height:14,borderRadius:7,background:i<value.length?"#8b5e52":"#e8d5d0"}}/>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:240,margin:"0 auto"}}>
          {digits.map((d,i)=><button key={i} onClick={()=>{if(d==="")return;if(d==="X"){setValue(p=>p.slice(0,-1));return;}if(value.length<4)setValue(p=>p+d);}} style={{height:56,borderRadius:14,border:"1px solid #f0ddd8",background:d===""?"transparent":"#fff",fontSize:20,color:"#3a2a27",cursor:d===""?"default":"pointer"}}>{d==="X"?"<":d}</button>)}
        </div>
      </div>
    );
  }
  return(
    <div style={{paddingBottom:70}}>
      <div style={S.header}><div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Reglages</h1></div></div>
      <div style={{padding:"20px 18px"}}>
        {step==="menu"&&(
          <div>
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #f0ddd8",overflow:"hidden",marginBottom:16}}>
              <div style={{padding:"14px 16px",borderBottom:"1px solid #f5ede9"}}>
                <div style={{fontSize:12,color:"#b5938a",fontWeight:500,marginBottom:2}}>CODE PIN</div>
                <div style={{fontSize:15,color:"#3a2a27",letterSpacing:4}}>{"*".repeat(savedPin.length)}</div>
              </div>
              <button onClick={()=>{setStep("verify");setOld("");}} style={{width:"100%",padding:"14px 16px",border:"none",background:"#fff",textAlign:"left",fontSize:15,color:"#8b5e52",fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                Changer le code PIN <span style={{color:"#c9a79e"}}>{">"}</span>
              </button>
            </div>
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #f0ddd8",padding:"14px 16px"}}>
              <div style={{fontSize:12,color:"#b5938a",fontWeight:500,marginBottom:8}}>A PROPOS</div>
              <div style={{fontSize:14,color:"#3a2a27",lineHeight:1.7}}>K's Beauty Studio v2.0<br/><span style={{color:"#c9a79e",fontSize:12}}>by K's Make Up Addict - Abidjan</span></div>
            </div>
          </div>
        )}
        {step==="verify"&&<div style={{textAlign:"center",paddingTop:20}}><PI value={old} setValue={setOld} label="Code actuel" onComplete={(v)=>{if(v===savedPin){setStep("newpin");setOld("");}else{setErr("Code incorrect");setTimeout(()=>{setOld("");setErr("");},800);}}}/>{err&&<div style={{color:"#9b2335",fontSize:13,marginTop:16}}>{err}</div>}<button onClick={reset} style={{marginTop:24,color:"#b5938a",background:"none",border:"none",fontSize:14,cursor:"pointer"}}>Annuler</button></div>}
        {step==="newpin"&&<div style={{textAlign:"center",paddingTop:20}}><PI value={nw} setValue={setNw} label="Nouveau code" onComplete={()=>setTimeout(()=>setStep("confirm"),300)}/><button onClick={reset} style={{marginTop:24,color:"#b5938a",background:"none",border:"none",fontSize:14,cursor:"pointer"}}>Annuler</button></div>}
        {step==="confirm"&&<div style={{textAlign:"center",paddingTop:20}}><PI value={conf} setValue={setConf} label="Confirmer le code" onComplete={(v)=>{if(v===nw){setSavedPin(nw);showToast("Code PIN modifie");reset();setView("list");}else{setErr("Les codes ne correspondent pas");setTimeout(()=>{setConf("");setErr("");},800);}}}/>{err&&<div style={{color:"#9b2335",fontSize:13,marginTop:16}}>{err}</div>}<button onClick={reset} style={{marginTop:24,color:"#b5938a",background:"none",border:"none",fontSize:14,cursor:"pointer"}}>Annuler</button></div>}
      </div>
    </div>
  );
}

function RdvFormView({rdvForm,clients,catalogue,onSave,onBack}){
  const [f,setF]=useState({...rdvForm,soins:rdvForm.soins?.length?rdvForm.soins:(rdvForm.soin?[rdvForm.soin]:[])});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const toggleSoin=(id)=>setF(p=>({...p,soins:p.soins.includes(id)?p.soins.filter(x=>x!==id):[...p.soins,id]}));
  const valid=f.soins?.length>0&&f.date&&f.heure&&(f.clientId||f.nomLibre?.trim());
  return(
    <div>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>Annuler</button>
        <div style={S.brandTag}>{f.id?"Modifier le RDV":"Nouveau RDV"}</div>
      </div>
      <div style={{padding:"16px 18px",paddingBottom:80}}>
        <Sect title="Cliente">
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:5}}>Cliente existante</div>
            <select value={f.clientId||""} onChange={e=>set("clientId",e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fdf8f6",fontSize:15,color:"#3a2a27"}}>
              <option value="">Selectionner</option>
              {[...clients].sort((a,b)=>a.nom.localeCompare(b.nom)).map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
            </select>
          </div>
          {!f.clientId&&<div><div style={{fontSize:11,color:"#2d6a4f",background:"#d8f0e7",borderRadius:8,padding:"6px 10px",marginBottom:10}}>Une fiche sera creee automatiquement</div><Fld label="Nom complet" value={f.nomLibre||""} onChange={v=>set("nomLibre",v)}/><Fld label="Telephone" value={f.tel||""} onChange={v=>set("tel",v)} type="tel"/></div>}
        </Sect>
        <Sect title="Date et heure"><TwoCol><Fld label="Date" value={f.date} onChange={v=>set("date",v)} type="date"/><Fld label="Heure" value={f.heure} onChange={v=>set("heure",v)} type="time"/></TwoCol></Sect>
        <Sect title="Soins"><SoinsSelector selected={f.soins||[]} onToggle={toggleSoin} catalogue={catalogue}/></Sect>
        <Sect title="Note (optionnel)"><Fld label="" value={f.note||""} onChange={v=>set("note",v)} multiline/></Sect>
        <button style={{...S.saveBtn,opacity:valid?1:0.5}} disabled={!valid} onClick={()=>onSave(f)}>{f.id?"Modifier":"Confirmer le RDV"}</button>
      </div>
    </div>
  );
}

function SoinsSelector({selected,onToggle,catalogue}){
  return(
    <div>
      {CATEGORIES.map(cat=>{
        const items=catalogue.filter(s=>s.categorie===cat);if(!items.length)return null;
        return(
          <div key={cat} style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#c9a79e",letterSpacing:1,textTransform:"uppercase",marginBottom:8,fontWeight:500}}>{cat}</div>
            {items.map(s=>{
              const active=selected.includes(s.id);const color=s.couleur||"#8b5e52";
              return<button key={s.id} onClick={()=>onToggle(s.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 14px",marginBottom:7,borderRadius:12,border:active?`1.5px solid ${color}`:"1px solid #e8d5d0",background:active?`${color}18`:"#fff",textAlign:"left",cursor:"pointer"}}>
                <div><div style={{fontSize:14,fontWeight:active?600:400,color:active?color:"#3a2a27"}}>{s.nom}</div><div style={{fontSize:11,color:"#b5938a",marginTop:1}}>{s.duree}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:600,color:active?color:"#8b5e52"}}>{s.prix}</span>{active&&<span style={{color,fontSize:14}}>✓</span>}</div>
              </button>;
            })}
          </div>
        );
      })}
    </div>
  );
}
function Sect({title,children}){return <div style={{marginBottom:22}}><div style={{fontSize:16,color:"#8b5e52",marginBottom:10,borderBottom:"1px solid #f0ddd8",paddingBottom:6,fontWeight:600}}>{title}</div>{children}</div>;}
function TwoCol({children}){return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{children}</div>;}
function Fld({label,value,onChange,type="text",multiline}){
  const b={width:"100%",background:"#fdf8f6",border:"1px solid #e8d5d0",borderRadius:10,padding:"10px 12px",fontSize:15,color:"#3a2a27",fontFamily:"inherit"};
  return <div style={{marginBottom:12}}>{label&&<div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:5}}>{label}</div>}{multiline?<textarea value={value} onChange={e=>onChange(e.target.value)} rows={3} style={{...b,resize:"none",lineHeight:1.5}}/>:<input value={value} onChange={e=>onChange(e.target.value)} type={type} style={b}/>}</div>;
}
function Chips({items,selected,onToggle}){
  return <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:4}}>{items.map(item=>{const a=selected.includes(item);return <button key={item} onClick={()=>onToggle(item)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,border:a?"1.5px solid #8b5e52":"1px solid #e8d5d0",background:a?"#8b5e52":"#fff",color:a?"#fff":"#8b5e52",cursor:"pointer"}}>{item}</button>;})}</div>;
}

const S={
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px 12px",background:"#fdf6f3",position:"sticky",top:0,zIndex:10,borderBottom:"1px solid #f0ddd8"},
  brandTag:{fontSize:10,letterSpacing:2,color:"#b5938a",textTransform:"uppercase",fontWeight:500},
  title:{fontSize:"clamp(20px,5vw,26px)",color:"#3a2a27",margin:"2px 0 0",fontWeight:700},
  btnRound:{width:40,height:40,borderRadius:20,background:"#8b5e52",color:"#fff",border:"none",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0},
  btnSmall:{padding:"6px 14px",borderRadius:20,border:"none",background:"#f0ddd8",color:"#8b5e52",fontSize:13,fontWeight:500,cursor:"pointer"},
  backBtn:{background:"none",border:"none",color:"#8b5e52",fontSize:15,padding:0,cursor:"pointer"},
  saveBtn:{width:"100%",padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#8b5e52,#c9896e)",color:"#fff",border:"none",fontSize:16,fontWeight:500,marginTop:8,cursor:"pointer"},
  btnSave:{flex:2,padding:"10px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#8b5e52,#c9896e)",color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"},
  btnCancel:{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fff",color:"#8b5e52",fontSize:13,cursor:"pointer"},
  weekNavBtn:{background:"none",border:"1px solid #e8d5d0",borderRadius:20,width:30,height:30,fontSize:16,color:"#8b5e52",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"},
  iconBtn:{width:28,height:28,borderRadius:14,border:"none",background:"#f0ddd8",color:"#8b5e52",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
};
