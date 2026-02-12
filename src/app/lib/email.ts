// Klaviyo email integration for eddytrains

const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY || ''
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID || '' // "Fitness app clients" list

export async function sendWelcomeEmail({
  to,
  name,
  tempPassword,
  loginUrl
}: {
  to: string
  name: string
  tempPassword: string
  loginUrl: string
}) {
  // If no Klaviyo key, return success but note email wasn't sent
  if (!KLAVIYO_API_KEY) {
    console.log('No Klaviyo API key - skipping email send')
    return { success: true, data: null, skipped: true }
  }

  try {
    // Step 1: Create/update profile in Klaviyo with custom properties
    const profileResponse = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
        'Content-Type': 'application/json',
        'revision': '2024-02-15'
      },
      body: JSON.stringify({
        data: {
          type: 'profile',
          attributes: {
            email: to,
            first_name: name,
            properties: {
              temp_password: tempPassword,
              login_url: loginUrl,
              account_type: 'fitness_client'
            }
          }
        }
      })
    })

    let profileId: string

    if (profileResponse.status === 409) {
      // Profile already exists - get the existing profile ID and update it
      const existingData = await profileResponse.json()
      profileId = existingData.errors?.[0]?.meta?.duplicate_profile_id
      
      if (profileId) {
        // Update existing profile with temp password
        await fetch(`https://a.klaviyo.com/api/profiles/${profileId}/`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
            'Content-Type': 'application/json',
            'revision': '2024-02-15'
          },
          body: JSON.stringify({
            data: {
              type: 'profile',
              id: profileId,
              attributes: {
                properties: {
                  temp_password: tempPassword,
                  login_url: loginUrl
                }
              }
            }
          })
        })
      }
    } else if (!profileResponse.ok) {
      const errorData = await profileResponse.json()
      console.error('Klaviyo profile creation error:', errorData)
      return { success: false, error: 'Failed to create Klaviyo profile' }
    } else {
      const profileData = await profileResponse.json()
      profileId = profileData.data.id
    }

    // Step 2: Add profile to the fitness clients list (this triggers the welcome email flow)
    if (KLAVIYO_LIST_ID && profileId) {
      const listResponse = await fetch(`https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
          'Content-Type': 'application/json',
          'revision': '2024-02-15'
        },
        body: JSON.stringify({
          data: [
            {
              type: 'profile',
              id: profileId
            }
          ]
        })
      })

      if (!listResponse.ok) {
        const errorData = await listResponse.json()
        console.error('Klaviyo list add error:', errorData)
        // Continue anyway - profile was created
      }
    }

    return { success: true, data: { profileId } }
  } catch (error) {
    console.error('Klaviyo email error:', error)
    return { success: false, error: 'Failed to send email via Klaviyo' }
  }
}
