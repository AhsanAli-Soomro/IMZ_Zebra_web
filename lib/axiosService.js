import axios from 'axios';

export async function get(url, params = {}) {
  try {
    const response = await axios.get(url, { params });
    return response.data; 
  } catch (error) {
    console.error('GET request failed:', error);
    throw error; 
  }
}

export async function post(url, data = {}) {
  try {
    const response = await axios.post(url, data);
    return response.data;
  } catch (error) {
    console.error('POST request failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data); // Log the response error data
      console.error('Status:', error.response.status); // Log the HTTP status code
    } else if (error.request) {
      console.error('Request:', error.request); // Log the request if no response was received
    } else {
      console.error('Error:', error.message); // Log any other error message
    }
    throw error;
  }
}


export async function put(url, data = {}) {
  try {
    const response = await axios.put(url, data);
    return response.data;
  } catch (error) {
    console.error('PUT request failed:', error);
    throw error;
  }
}
 