import OperationsConsole from "./operations-console";

export default async function Home({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const {page}=await searchParams;
  return <OperationsConsole initialPage={page==='operations'?'operations':'overview'}/>;
}
