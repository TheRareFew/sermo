import { NextResponse } from 'next/server'

let messages: string[] = []

export async function GET() {
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const { message } = await request.json()
  if (message && typeof message === 'string') {
    messages.push(message)
    return NextResponse.json({ success: true, messages })
  } else {
    return NextResponse.json({ success: false, error: 'Invalid message' }, { status: 400 })
  }
}

