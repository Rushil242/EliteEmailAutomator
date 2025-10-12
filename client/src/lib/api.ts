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

  // Start image generation (returns task ID)
  startImageGeneration: async (data: { imageDescription: string }) => {
    const response = await apiRequest('POST', '/api/generate-image/start', data);
    return response.json();
  },

  // Check image generation status
  checkImageStatus: async (taskId: string) => {
    const response = await fetch(`/api/generate-image/status/${taskId}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to check image status');
    }
    return response.json();
  }
};
