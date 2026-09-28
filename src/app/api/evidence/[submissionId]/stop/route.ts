import {NextRequest,NextResponse} from 'next/server';
import {controlEvidence} from '@/lib/evidence/service';
import {revalidatePath} from 'next/cache';
export async function POST(request:NextRequest,{params}:{params:Promise<{submissionId:string}>}){if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Request origin refused.'},{status:403});try{const {submissionId}=await params;const stopped=await controlEvidence(submissionId,'STOP');if(stopped)revalidatePath('/initiatives','layout');return NextResponse.json({stopped:stopped>0,...(stopped?{}:{reason:'NOT_RUNNING'})});}catch{return NextResponse.json({error:'Reading could not be stopped under your current access.'},{status:403});}}
