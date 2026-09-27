export default function PenroseMark({className}:{className?:string}){
  return <svg className={className} viewBox="0 0 48 52" aria-hidden="true" focusable="false">
    <defs><linearGradient id="penrose-mark-gold" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f7edcf"/><stop offset=".5" stopColor="#bca477"/><stop offset="1" stopColor="#e8d8ae"/></linearGradient></defs>
    <path d="M4 3 44 26 4 49Z" fill="url(#penrose-mark-gold)"/>
    <path d="M12 14 33 26 12 38Z" fill="#000" stroke="#f2e4c2" strokeWidth=".9"/>
    <path d="M4 3v46" fill="none" stroke="#fff1cc" strokeWidth="1.5"/>
  </svg>;
}
