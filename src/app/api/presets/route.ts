import { NextResponse } from 'next/server';

const defaultPresets = {
  meesho: { x0: 0, y0: 0, w: 595, h: 361, scale: 2 },
  flipkart: { x0: 165, y0: 22, w: 265, h: 360, scale: 2 }
};

export async function GET() {
  try {
    return NextResponse.json(defaultPresets);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('Saved new presets:', data);
    return NextResponse.json({ success: true, message: 'Presets saved' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to save presets' }, { status: 400 });
  }
}
