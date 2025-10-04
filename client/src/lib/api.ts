import { apiRequest } from "./queryClient";

export const api = {
  uploadContacts: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload-contacts', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload file');
    }
    
    return response.json();
  },

  createCampaign: async (data: { subject: string; message: string; contactIds: string[] }) => {
    const response = await apiRequest('POST', '/api/campaigns', data);
    return response.json();
  },

  sendCampaign: async (campaignId: string) => {
    const response = await apiRequest('POST', `/api/campaigns/${campaignId}/send`);
    return response.json();
  },

  getCampaignResults: async (campaignId: string) => {
    const response = await apiRequest('GET', `/api/campaigns/${campaignId}/results`);
    return response.json();
  },

  generateAiMessage: async (data: { messageType: string; promotionalIdea: string }) => {
    const response = await apiRequest('POST', '/api/ai-message', data);
    return response.json();
  },

  generateImage: async (data: { imageDescription: string }) => {
    const response = await apiRequest('POST', '/api/generate-image', data);
    return response.json();
  }
};
