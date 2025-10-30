import { supabase } from '../config/supabase';

export const thesisService = {
  async getThesisByFileUrl(fileUrl) {
    try {
      console.log('🔍 Looking up thesis by pdf_file_url:', fileUrl);
      
      if (!fileUrl) {
        throw new Error('File URL is required');
      }

      let searchUrl = fileUrl;
      
      if (fileUrl.includes('/')) {
        const urlParts = fileUrl.split('/');
        searchUrl = urlParts[urlParts.length - 1];
      }

      searchUrl = searchUrl.split('?')[0];
      
      console.log('🎯 Searching for thesis with file:', searchUrl);

      const { data, error } = await supabase
        .from('theses')
        .select('*')
        .ilike('pdf_file_url', `%${searchUrl}%`)
        .single();

      if (error) {
        console.error('❌ Supabase error:', error);
        if (error.code === 'PGRST116') {
          throw new Error('No thesis found for this file URL');
        }
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        throw new Error('Thesis not found for this file');
      }

      console.log('✅ Found thesis:', data.title);
      return data;
    } catch (error) {
      console.error('❌ Error fetching thesis by file URL:', error);
      throw error;
    }
  },

  async getThesisById(thesisId) {
    try {
      console.log('🔍 Fetching thesis with ID:', thesisId);
      
      if (!thesisId) {
        throw new Error('Thesis ID is required');
      }

      const id = parseInt(thesisId);
      if (isNaN(id)) {
        throw new Error('Invalid thesis ID');
      }

      const { data, error } = await supabase
        .from('theses')
        .select('*')
        .eq('thesis_id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Thesis not found');
        }
        throw error;
      }

      if (!data) {
        throw new Error('Thesis not found');
      }

      return data;
    } catch (error) {
      console.error('❌ Error fetching thesis by ID:', error);
      throw error;
    }
  },

  async processQRCodeData(qrData) {
    try {
      console.log('🔍 Processing QR code data:', qrData);
      
      let thesis;

      // Case 1: QR contains JSON with thesis_id
      try {
        const parsedData = JSON.parse(qrData);
        if (parsedData.thesis_id) {
          console.log('📋 QR contains thesis_id in JSON');
          thesis = await this.getThesisById(parsedData.thesis_id);
          return thesis;
        }
      } catch (e) {
        console.log('ℹ️ QR data is not JSON, checking other formats...');
      }

      // Case 2: QR contains PDF file URL
      if (qrData.includes('supabase.co/storage') && qrData.includes('.pdf')) {
        console.log('📄 QR contains PDF file URL');
        thesis = await this.getThesisByFileUrl(qrData);
        return thesis;
      }

      // Case 3: QR contains direct thesis ID (number)
      if (!isNaN(parseInt(qrData))) {
        console.log('🔢 QR contains direct thesis ID');
        thesis = await this.getThesisById(qrData);
        return thesis;
      }

      throw new Error('QR code does not contain valid thesis information');
    } catch (error) {
      console.error('❌ Error processing QR code data:', error);
      throw error;
    }
  },

  async recordUserScan(userId, thesisId) {
    try {
      console.log('📝 Recording user scan:', { userId, thesisId });
      
      const parsedUserId = this.normalizeUserId(userId);
      const parsedThesisId = parseInt(thesisId);

      if (!parsedUserId || isNaN(parsedThesisId)) {
        console.error('❌ Invalid IDs for recording scan');
        return { success: false, error: 'Invalid IDs' };
      }

      const { data, error } = await supabase
        .from('user_recent_scanned')
        .upsert({
          user_id: parsedUserId,
          thesis_id: parsedThesisId,
          scanned_date: new Date().toISOString()
        }, {
          onConflict: 'user_id,thesis_id'
        })
        .select();

      if (error) {
        console.error('❌ Error recording scan:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Scan recorded successfully');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error in recordUserScan:', error);
      return { success: false, error: error.message };
    }
  }, 

  // Alias for recordUserScan
  async recordThesisView(userId, thesisId) {
    return this.recordUserScan(userId, thesisId);
  }, 

  async requestAccess(userId, thesisId) {
    try {
      console.log('🔐 Requesting access for:', { userId, thesisId });
      
      // Validate inputs
      if (!userId || !thesisId) {
        throw new Error('User ID and Thesis ID are required');
      }

      const parsedUserId = parseInt(userId);
      const parsedThesisId = parseInt(thesisId);

      if (isNaN(parsedUserId) || isNaN(parsedThesisId)) {
        throw new Error('Invalid User ID or Thesis ID format');
      }

      // First check if there's already a pending request
      const { data: existingRequest, error: checkError } = await supabase
        .from('thesis_access_requests') // Correct table name from your schema
        .select('access_request_id')
        .eq('user_id', parsedUserId)
        .eq('thesis_id', parsedThesisId)
        .eq('status', 'pending')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingRequest) {
        throw new Error('You already have a pending request for this thesis');
      }

      const { data, error } = await supabase
        .from('thesis_access_requests') // Correct table name from your schema
        .insert({
          user_id: parsedUserId,
          thesis_id: parsedThesisId,
          status: 'pending',
          request_date: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Access request created:', data);
      return data;
    } catch (error) {
      console.error('❌ Error requesting access:', error);
      throw error;
    }
  },

  async getUserBorrowingStatus(userId, thesisId) {
    try {
      console.log('🔍 Checking access status for:', { userId, thesisId });
      
      // Convert to appropriate types
      const parsedUserId = this.normalizeUserId(userId);
      const parsedThesisId = parseInt(thesisId);

      if (!parsedUserId || isNaN(parsedThesisId)) {
        console.error('❌ Invalid IDs:', { parsedUserId, parsedThesisId });
        return { status: 'none', hasAccess: false, error: 'Invalid IDs' };
      }

      console.log('✅ Querying with IDs:', { parsedUserId, parsedThesisId });

      const { data, error } = await supabase
        .from('thesis_access_requests')
        .select('*')
        .eq('user_id', parsedUserId)
        .eq('thesis_id', parsedThesisId)
        .order('request_date', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle instead of single to avoid throwing error when no record found

      if (error) {
        console.error('❌ Database error:', error);
        return { status: 'none', hasAccess: false, error: error.message };
      }

      if (!data) {
        console.log('ℹ️ No access request found');
        return { status: 'none', hasAccess: false };
      }

      console.log('✅ Access request found:', data);

      const now = new Date();
      let hasAccess = false;
      let isExpired = false;

      if (data.status === 'approved' && data.approved_date) {
        const approvedDate = new Date(data.approved_date);
        const removeAccessDate = data.remove_access_date ? new Date(data.remove_access_date) : null;
        
        if (removeAccessDate) {
          hasAccess = now < removeAccessDate;
          isExpired = now >= removeAccessDate;
          console.log(`⏰ Access dates - Now: ${now}, Expires: ${removeAccessDate}, HasAccess: ${hasAccess}`);
        } else {
          // No expiry date set - access is permanent
          hasAccess = true;
          isExpired = false;
          console.log('✅ Permanent access granted');
        }
      }

      const result = {
        ...data,
        hasAccess,
        isExpired,
        expiryDate: data.remove_access_date
      };

      console.log('✅ Final access result:', result);
      return result;

    } catch (error) {
      console.error('❌ Error in getUserBorrowingStatus:', error);
      return { 
        status: 'none', 
        hasAccess: false, 
        error: error.message 
      };
    }
  },

  normalizeUserId(userId) {
    if (!userId) return null;
    
    // If it's a UUID (contains dashes), return as string
    if (typeof userId === 'string' && userId.includes('-')) {
      return userId;
    }
    
    // Try to parse as integer
    const parsed = parseInt(userId);
    return isNaN(parsed) ? userId : parsed;
  },


  async getRecentScannedTheses(userId, limit = 5) {
    try {
      const { data, error } = await supabase
        .from('user_recent_scanned')
        .select(`
          scanned_date,
          theses (
            thesis_id,
            title,
            author,
            abstract,
            college_department,
            batch,
            pdf_file_url,
            created_at
          )
        `)
        .eq('user_id', userId)
        .order('scanned_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Format the data
      const formattedTheses = (data || []).map(item => ({
        thesis_id: item.theses.thesis_id,
        title: item.theses.title,
        author: item.theses.author,
        abstract: item.theses.abstract,
        college_department: item.theses.college_department,
        batch: item.theses.batch,
        pdf_file_url: item.theses.pdf_file_url,
        scanned_date: item.scanned_date
      }));

      return formattedTheses;
    } catch (error) {
      console.error('❌ Error fetching recent scanned theses:', error);
      return [];
    }
  }, 

    async getRecentTheses(userId) {
    try {
      return await this.getRecentScannedTheses(userId, 5);
    } catch (error) {
      console.error('❌ Error fetching recent theses:', error);
      return [];
    }
  }, 

  // SIMPLE PDF URL GENERATOR - No download functionality
  async getSecurePdfUrl(fileUrl) {
    try {
      console.log('🔍 Generating secure PDF URL from:', fileUrl);
      
      if (!fileUrl) {
        throw new Error('No PDF file URL provided');
      }
      
      // If it's already a full URL, use it directly
      if (fileUrl.startsWith('http')) {
        console.log('✅ Using existing full URL');
        return fileUrl;
      }
      
      // Extract filename from various formats
      let fileName = fileUrl;
      
      // Handle different URL formats
      if (fileUrl.includes('/')) {
        const parts = fileUrl.split('/');
        fileName = parts[parts.length - 1];
      }
      
      // Remove query parameters
      fileName = fileName.split('?')[0];
      
      // Clean up the filename
      fileName = fileName.trim();
      
      console.log('📄 Extracted filename:', fileName);
      
      // Try different bucket configurations
      const buckets = [
        'thesis_files',      // Your original bucket name
        'thesis-files',      // With dash (mentioned in your code)
        'thesisfiles',       // Without separator
      ];
      
      const folders = [
        'thesis-pdfs',       // Your folder
        'pdfs',              // Alternative folder
        '',                  // Root of bucket
      ];
      
      // Test different combinations
      for (const bucket of buckets) {
        for (const folder of folders) {
          const testUrl = folder 
            ? `${supabase.supabaseUrl}/storage/v1/object/public/${bucket}/${folder}/${fileName}`
            : `${supabase.supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`;
          
          console.log(`🔗 Testing URL: ${testUrl}`);
          
          const exists = await this.verifyPdfExists(testUrl);
          if (exists) {
            console.log(`✅ Found valid PDF at: ${testUrl}`);
            return testUrl;
          }
        }
      }
      
      throw new Error('PDF not found in any storage location');
      
    } catch (error) {
      console.error('❌ Error generating PDF URL:', error);
      throw new Error('Could not generate PDF URL: ' + error.message);
    }
  },

  async debugStorageContents() {
    try {
      console.log('🔍 Debugging storage contents...');
      
      const { data: pdfFiles, error: pdfError } = await supabase.storage
        .from('thesis_files')
        .list('', {
          limit: 100,
          offset: 0,
        });
      
      if (pdfError) {
        console.error('❌ Error listing thesis files:', pdfError);
      } else {
        console.log('📁 Files in thesis_files bucket:', pdfFiles?.map(f => f.name) || []);
      }
      
    } catch (error) {
      console.error('❌ Debug error:', error);
    }
  },

  async searchTheses(query, filters = {}) {
    try {
      let queryBuilder = supabase
        .from('theses')
        .select('*')
        .order('created_at', { ascending: false });

      // Add text search
      if (query) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,author.ilike.%${query}%,abstract.ilike.%${query}%`);
      }

      // Add filters
      if (filters.college_department) {
        queryBuilder = queryBuilder.eq('college_department', filters.college_department);
      }

      if (filters.batch) {
        queryBuilder = queryBuilder.eq('batch', filters.batch);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error searching theses:', error);
      throw error;
    }
  },

  // SIMPLE PDF VERIFICATION - No download
  async verifyPdfExists(fileUrl) {
    try {
      console.log('🔍 Verifying PDF exists:', fileUrl);
      const response = await fetch(fileUrl, { method: 'HEAD' });
      const exists = response.ok;
      console.log('✅ PDF verification result:', exists);
      return exists;
    } catch (error) {
      console.error('❌ Error verifying PDF existence:', error);
      return false;
    }
  },

  async updateBookInventoryStatus(thesisId, status) {
    try {
      const { data, error } = await supabase
        .from('bookshelf_inventory')
        .update({ 
          current_status: status
        })
        .eq('thesis_id', thesisId)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error updating book inventory status:', error);
      throw error;
    }
  },

  async logBookshelfAction(userId, thesisId, status) {
    try {
      const { data, error } = await supabase
        .from('bookshelf_logs')
        .insert({
          user_id: userId,
          thesis_id: thesisId,
          status: status,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error logging bookshelf action:', error);
      throw error;
    }
  },

  async createBorrowQR(userId, thesisId) {
    try {
      console.log('🎫 Creating simple borrow QR for:', { userId, thesisId });
      
      // Validate inputs
      if (!userId || !thesisId) {
        throw new Error('User ID and Thesis ID are required');
      }

      const parsedUserId = parseInt(userId);
      const parsedThesisId = parseInt(thesisId);

      if (isNaN(parsedUserId) || isNaN(parsedThesisId)) {
        throw new Error('Invalid User ID or Thesis ID format');
      }

      // Simple QR data - only essential info for ESP32
      const qrData = {
        thesis_id: parsedThesisId,
        user_id: parsedUserId
        // Removed all other fields to keep it simple
      };

      console.log('✅ Simple QR data created:', qrData);
      return qrData;
    } catch (error) {
      console.error('❌ Error creating borrow QR:', error);
      throw error;
    }
  },

  async debugStorageStructure() {
    try {
      console.log('🔍 Debugging storage structure...');
      
      // List all buckets
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        console.error('❌ Error listing buckets:', bucketsError);
      } else {
        console.log('📦 Available buckets:', buckets?.map(b => b.name) || []);
      }
      
      // List files in thesis-files bucket (with dash)
      const { data: files, error: filesError } = await supabase.storage
        .from('thesis-files') // Changed to dash
        .list('', { limit: 100 });
      
      if (filesError) {
        console.error('❌ Error listing files:', filesError);
      } else {
        console.log('📁 Files in thesis-files bucket:', files?.map(f => f.name) || []);
        
        // List files in thesis-pdfs folder if it exists
        const { data: pdfFiles, error: pdfError } = await supabase.storage
          .from('thesis-files') // Changed to dash
          .list('thesis-pdfs', { limit: 100 });
        
        if (pdfError) {
          console.log('ℹ️ No thesis-pdfs folder or error:', pdfError.message);
        } else {
          console.log('📄 Files in thesis-pdfs folder:', pdfFiles?.map(f => f.name) || []);
        }
      }
    } catch (error) {
      console.error('❌ Debug error:', error);
    }
  }
};