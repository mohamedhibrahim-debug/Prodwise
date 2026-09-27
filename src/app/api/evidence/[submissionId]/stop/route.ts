import {NextRequest,NextResponse} from 'next/server';
import {controlEvidence} from '@/lib/evidence/service';
import {revalidatePath} from 'next/cache';
export async function POST(request:NextRequest,{params}:{params:Promise<{submissionId:string}>}){if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Request origin refused.'},{status:403});try{const {submissionId}=await params;await controlEvidence(submissionId,'STOP');revalidatePath('/initiatives','layout');return NextResponse.json({stopped:true});}catch{return NextResponse.json({error:'Reading could not be stopped under your current access.'},{status:403});}}
