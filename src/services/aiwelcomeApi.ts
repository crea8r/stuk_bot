import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import {
  AIWELCOME_API_KEY,
  AIWELCOME_BASE_URL,
  AIWELCOME_PROJECT_ID,
  AIWELCOME_CHAT_ENGINE,
  AIWELCOME_CHAT_ORIGIN,
} from '../config';

const url = `${AIWELCOME_BASE_URL}/projects/${AIWELCOME_PROJECT_ID}/chatengines/${AIWELCOME_CHAT_ENGINE}/query`;

export async function queryAIWelcome(question: string): Promise<string> {
  const formData = new URLSearchParams();
  formData.append('prompt', question);
  formData.append('k', AIWELCOME_API_KEY);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: AIWELCOME_CHAT_ORIGIN,
      },
      body: formData.toString(),
    });

    if (response.status === 200) {
      const data: any = await response.json();
      if (!data.error) {
        return data.textRaw;
      } else {
        throw new Error('AIWelcome API returned an error');
      }
    } else {
      throw new Error('AIWelcome API request failed');
    }
  } catch (error) {
    console.error('Error querying AIWelcome API:', error);
    throw error;
  }
}
