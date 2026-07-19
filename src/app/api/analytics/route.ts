import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('--- Analytics Logged ---');
    console.log(`Files Processed: ${data.filesProcessed}`);
    console.log(`Pages Processed: ${data.pagesProcessed}`);
    console.log(`Meesho count: ${data.platforms.meesho}, Flipkart count: ${data.platforms.flipkart}`);
    
    // In a real app, this would be saved to a database
    return NextResponse.json({ success: true, message: 'Analytics logged successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to log analytics' }, { status: 400 });
  }
}
