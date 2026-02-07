import { NextRequest, NextResponse } from 'next/server'

const RAPIDAPI_KEY = process.env.EXERCISEDB_API_KEY || 'c2d14f4cb9mshc18d762001165d2p1e5fcfjsnaea451689900'
const RAPIDAPI_HOST = 'exercisedb.p.rapidapi.com'

// Cache exercise name → exercisedb ID mappings in memory
const exerciseIdCache = new Map<string, string | null>()

// Normalize exercise name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')
    .trim()
}

// Search ExerciseDB for exercise by name
async function findExerciseId(exerciseName: string): Promise<string | null> {
  const normalized = normalizeName(exerciseName)
  
  // Check cache first
  if (exerciseIdCache.has(normalized)) {
    return exerciseIdCache.get(normalized) || null
  }
  
  try {
    // Search by name
    const searchRes = await fetch(
      `https://${RAPIDAPI_HOST}/exercises/name/${encodeURIComponent(normalized)}?limit=5`,
      {
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      }
    )
    
    if (!searchRes.ok) {
      console.error('ExerciseDB search failed:', searchRes.status)
      exerciseIdCache.set(normalized, null)
      return null
    }
    
    const results = await searchRes.json()
    
    if (results && results.length > 0) {
      // Find best match (exact or closest)
      const exactMatch = results.find(
        (ex: { name: string }) => normalizeName(ex.name) === normalized
      )
      
      const exerciseId = exactMatch?.id || results[0]?.id
      exerciseIdCache.set(normalized, exerciseId)
      return exerciseId
    }
    
    exerciseIdCache.set(normalized, null)
    return null
  } catch (error) {
    console.error('ExerciseDB lookup error:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const exerciseName = searchParams.get('name')
  const exerciseId = searchParams.get('id') // Direct ID if known
  const resolution = searchParams.get('resolution') || '360' // 360, 720, or 1080
  
  if (!exerciseName && !exerciseId) {
    return NextResponse.json(
      { error: 'Missing name or id parameter' },
      { status: 400 }
    )
  }
  
  // Validate resolution
  if (!['360', '720', '1080'].includes(resolution)) {
    return NextResponse.json(
      { error: 'Invalid resolution. Use 360, 720, or 1080' },
      { status: 400 }
    )
  }
  
  try {
    // Get exercise ID (from param or lookup by name)
    let targetId = exerciseId
    if (!targetId && exerciseName) {
      targetId = await findExerciseId(exerciseName)
    }
    
    if (!targetId) {
      return NextResponse.json(
        { error: 'Exercise not found in ExerciseDB' },
        { status: 404 }
      )
    }
    
    // Fetch image from ExerciseDB
    const imageRes = await fetch(
      `https://${RAPIDAPI_HOST}/image?resolution=${resolution}&exerciseId=${targetId}`,
      {
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      }
    )
    
    if (!imageRes.ok) {
      console.error('ExerciseDB image fetch failed:', imageRes.status)
      return NextResponse.json(
        { error: 'Failed to fetch exercise image' },
        { status: imageRes.status }
      )
    }
    
    // Stream the GIF back
    const imageBuffer = await imageRes.arrayBuffer()
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour (allowed per ExerciseDB terms for transient caching)
      },
    })
  } catch (error) {
    console.error('Exercise GIF proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
