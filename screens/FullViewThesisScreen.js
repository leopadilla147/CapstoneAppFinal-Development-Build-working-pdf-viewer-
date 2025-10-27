import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  AppState,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Pdf from 'react-native-pdf';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { thesisService } from '../services/thesisService';

// Import only expo-screen-capture (available in Expo)
import * as ScreenCapture from 'expo-screen-capture';

const { width, height } = Dimensions.get('window');

const FullViewThesisScreen = ({ navigation, route }) => {
  const { thesis } = route.params;
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [accessStatus, setAccessStatus] = useState('pending');
  const [requestData, setRequestData] = useState(null);
  const [securityActive, setSecurityActive] = useState(true);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfLoadingProgress, setPdfLoadingProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const pdfRef = useRef(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    loadUserData();
    activateSecurity();
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
      deactivateSecurity();
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      checkAccessStatus();
    }
  }, [currentUser]);

  const getUserId = (user) => {
    if (!user) {
      console.log('❌ getUserId: user is null/undefined');
      return null;
    }
    
    const possibleIdFields = [
      'user_id', 'id', 'userID', 'userId', 'uid', 
      'sub', 'user_uuid', 'uuid'
    ];
    
    for (const field of possibleIdFields) {
      if (user[field] !== undefined && user[field] !== null) {
        console.log(`✅ Found user ID in field '${field}':`, user[field]);
        return user[field];
      }
    }
    
    if (user.user && getUserId(user.user)) {
      return getUserId(user.user);
    }
    
    if (user.session && user.session.user && getUserId(user.session.user)) {
      return getUserId(user.session.user);
    }
    
    if (user.identities && user.identities.length > 0) {
      const identity = user.identities[0];
      if (identity.user_id) {
        console.log('✅ Found user ID in identities[0].user_id:', identity.user_id);
        return identity.user_id;
      }
    }
    
    console.log('❌ No user ID found in any field');
    return null;
  };

  const loadUserData = async () => {
    try {
      console.log('🔄 Loading user data from AsyncStorage...');
      const userData = await AsyncStorage.getItem('user');
      
      if (userData) {
        const user = JSON.parse(userData);
        let finalUser = user;
        
        if (user.user) {
          console.log('ℹ️ User data is nested under .user');
          finalUser = user.user;
        }
        
        if (user.session && user.session.user) {
          console.log('ℹ️ User data is in session.user');
          finalUser = user.session.user;
        }
        
        setCurrentUser(finalUser);
        console.log('✅ Final user set to state');
        
      } else {
        console.log('❌ No user data found in AsyncStorage');
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error);
    }
  };

  // Security functions using only expo-screen-capture
  const activateSecurity = async () => {
    try {
      await ScreenCapture.preventScreenCaptureAsync();
      setSecurityActive(true);
      console.log('🔒 Security activated: Screenshots disabled');
    } catch (error) {
      console.error('Error activating security:', error);
    }
  };

  const deactivateSecurity = async () => {
    try {
      await ScreenCapture.allowScreenCaptureAsync();
      setSecurityActive(false);
      console.log('🔓 Security deactivated: Screenshots enabled');
    } catch (error) {
      console.error('Error deactivating security:', error);
    }
  };

  const handleAppStateChange = (nextAppState) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      activateSecurity();
    } else if (nextAppState.match(/inactive|background/)) {
      deactivateSecurity();
      setShowPdfViewer(false);
    }
    appState.current = nextAppState;
  };

  const checkAccessStatus = async () => {
    if (!currentUser) {
      console.log('No current user, skipping access check');
      setAccessStatus('none');
      setLoading(false);
      return;
    }

    try {
      const thesisId = thesis.thesis_id || thesis.id;
      
      if (!thesisId) {
        console.error('❌ No thesis ID found in thesis object:', thesis);
        setAccessStatus('none');
        setLoading(false);
        return;
      }

      const userId = getUserId(currentUser);
      
      if (!userId) {
        console.error('❌ No user ID found for access check');
        setAccessStatus('none');
        setLoading(false);
        return;
      }

      console.log('✅ Checking access with:', { userId, thesisId });

      const userBorrowingStatus = await thesisService.getUserBorrowingStatus(userId, thesisId);
      console.log('✅ User borrowing status:', userBorrowingStatus);
      
      setRequestData(userBorrowingStatus);
      
      if (userBorrowingStatus.error) {
        console.error('❌ Error in borrowing status:', userBorrowingStatus.error);
        setAccessStatus('none');
      } else if (userBorrowingStatus.status === 'approved' && !userBorrowingStatus.isExpired) {
        console.log('✅ Access approved');
        setAccessStatus('approved');
      } else if (userBorrowingStatus.status === 'approved' && userBorrowingStatus.isExpired) {
        console.log('⚠️ Access expired');
        setAccessStatus('expired');
      } else if (userBorrowingStatus.status === 'pending') {
        console.log('⏳ Access pending');
        setAccessStatus('pending');
      } else if (userBorrowingStatus.status === 'denied') {
        console.log('❌ Access denied');
        setAccessStatus('denied');
      } else {
        console.log('ℹ️ No access request found');
        setAccessStatus('none');
      }
    } catch (error) {
      console.error('❌ Error checking access status:', error);
      setAccessStatus('none');
    } finally {
      setLoading(false);
    }
  };

  const viewPdf = async () => {
    if (!thesis.pdf_file_url) {
      Alert.alert('Error', 'No PDF file available for this thesis.');
      return;
    }

    setIsLoadingPdf(true);
    setPdfLoadError(false);
    setPdfLoadingProgress(0);

    try {
      console.log('📄 Preparing PDF for streaming:', thesis.pdf_file_url);
      
      const finalPdfUrl = await thesisService.getSecurePdfUrl(thesis.pdf_file_url);
      
      console.log('🔗 Final PDF URL for streaming:', finalPdfUrl);
      
      const pdfExists = await thesisService.verifyPdfExists(finalPdfUrl);
      if (!pdfExists) {
        throw new Error('PDF file not found on server');
      }
      
      setPdfUrl(finalPdfUrl);
      setShowPdfViewer(true);
      
    } catch (error) {
      console.error('❌ PDF preparation error:', error);
      setPdfLoadError(true);
      Alert.alert(
        'Error Loading PDF',
        'The thesis document could not be loaded. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleClosePdfViewer = () => {
    setShowPdfViewer(false);
    setPdfUrl(null);
    setCurrentPage(0);
    setTotalPages(0);
    setPdfLoadingProgress(0);
  };

  const handlePdfLoadComplete = (numberOfPages, filePath) => {
    console.log(`✅ PDF loaded successfully: ${numberOfPages} pages`);
    setTotalPages(numberOfPages);
    setPdfLoadError(false);
  };

  const handlePdfError = (error) => {
    console.error('❌ PDF loading error:', error);
    setPdfLoadError(true);
  };

  const handlePageChanged = (page, numberOfPages) => {
    setCurrentPage(page);
    console.log(`📄 Current page: ${page} of ${numberOfPages}`);
  };

  const goToNextPage = () => {
    if (pdfRef.current && currentPage < totalPages) {
      pdfRef.current.setPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (pdfRef.current && currentPage > 1) {
      pdfRef.current.setPage(currentPage - 1);
    }
  };

  const getStatusMessage = () => {
    switch (accessStatus) {
      case 'approved':
        return {
          title: 'Access Granted',
          message: 'You can now view the full thesis.',
          color: '#28a745',
          icon: 'check-circle'
        };
      case 'pending':
        return {
          title: 'Pending Approval',
          message: 'Your access request is pending administrator approval.',
          color: '#ffc107',
          icon: 'clock'
        };
      case 'expired':
        return {
          title: 'Access Expired',
          message: 'Your access to this thesis has expired. Please request access again.',
          color: '#dc3545',
          icon: 'clock-alert'
        };
      case 'denied':
        return {
          title: 'Access Denied',
          message: 'Your access request was denied. Please contact administrator for more information.',
          color: '#dc3545',
          icon: 'cancel'
        };
      default:
        return {
          title: 'Access Required',
          message: 'You need to request access to view this thesis.',
          color: '#6c757d',
          icon: 'lock'
        };
    }
  };

  const statusInfo = getStatusMessage();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#dc3545" />
          <Text style={styles.loadingText}>Checking access permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#dc3545" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Full Thesis View</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Security Warning */}
      <View style={styles.securityWarning}>
        <Icon name="shield-lock" size={16} color="#fff" />
        <Text style={styles.securityText}>
          🔒 Protected Content - Screenshots are disabled
        </Text>
      </View>

      {/* Access Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: statusInfo.color }]}>
        <Icon name={statusInfo.icon} size={20} color="#FFFFFF" />
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusTitle}>{statusInfo.title}</Text>
          <Text style={styles.statusMessage}>{statusInfo.message}</Text>
        </View>
      </View>

      {/* PDF Viewer Modal */}
      <Modal
        visible={showPdfViewer}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClosePdfViewer}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={handleClosePdfViewer}
            >
              <Icon name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {thesis?.title?.substring(0, 30) || 'Thesis Viewer'}...
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* PDF Controls */}
          <View style={styles.pdfControls}>
            <TouchableOpacity 
              style={[styles.controlButton, currentPage <= 1 && styles.controlButtonDisabled]}
              onPress={goToPreviousPage}
              disabled={currentPage <= 1}
            >
              <Icon name="chevron-left" size={24} color={currentPage <= 1 ? "#999" : "#dc3545"} />
              <Text style={[styles.controlText, currentPage <= 1 && styles.controlTextDisabled]}>
                Previous
              </Text>
            </TouchableOpacity>

            <View style={styles.pageInfo}>
              <Text style={styles.pageText}>
                Page {currentPage} of {totalPages}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.controlButton, currentPage >= totalPages && styles.controlButtonDisabled]}
              onPress={goToNextPage}
              disabled={currentPage >= totalPages}
            >
              <Text style={[styles.controlText, currentPage >= totalPages && styles.controlTextDisabled]}>
                Next
              </Text>
              <Icon name="chevron-right" size={24} color={currentPage >= totalPages ? "#999" : "#dc3545"} />
            </TouchableOpacity>
          </View>

          {/* Security Status */}
          <View style={styles.securityStatus}>
            <Icon name="shield-check" size={16} color="#28a745" />
            <Text style={styles.securityStatusText}>
              🔒 Secure Streaming - Downloads are disabled
            </Text>
          </View>

          {pdfUrl && !pdfLoadError ? (
            <View style={styles.pdfContainer}>
              <Pdf
                ref={pdfRef}
                source={{ 
                  uri: pdfUrl,
                  cache: false, // Disable caching for security
                }}
                style={styles.pdf}
                onLoadComplete={handlePdfLoadComplete}
                onPageChanged={handlePageChanged}
                onError={handlePdfError}
                onPressLink={(uri) => {
                  console.log(`Link pressed: ${uri}`);
                  // Block external links for security
                  Alert.alert('Security Notice', 'External links are disabled in secure mode.');
                }}
                enablePaging={true}
                enableRTL={false}
                enableAnnotationRendering={false} // Disable annotations for security
                fitPolicy={0}
                trustAllCerts={Platform.OS === 'ios'} // iOS requires this for some certificates
                spacing={10}
                minScale={1.0}
                maxScale={3.0}
                activityIndicator={
                  <View style={styles.pdfLoading}>
                    <ActivityIndicator size="large" color="#dc3545" />
                    <Text style={styles.pdfLoadingText}>Loading secure thesis document...</Text>
                    {pdfLoadingProgress > 0 && (
                      <Text style={styles.progressText}>
                        Progress: {Math.round(pdfLoadingProgress * 100)}%
                      </Text>
                    )}
                  </View>
                }
              />
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={48} color="#dc3545" />
              <Text style={styles.errorTitle}>Failed to Load PDF</Text>
              <Text style={styles.errorMessage}>
                The thesis document could not be loaded. Please try again later.
              </Text>
              <View style={styles.errorButtons}>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={viewPdf}
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={handleClosePdfViewer}
                >
                  <Text style={styles.closeButtonText}>Close Viewer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Main Content */}
      <ScrollView 
        style={styles.mainContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.thesisContainer}>
          <Text style={styles.thesisTitle}>{thesis?.title || 'No Title Available'}</Text>
          
          {/* Thesis Metadata */}
          <View style={styles.metadataContainer}>
            <View key="author" style={styles.metadataItem}>
              <Icon name="account" size={16} color="#666" />
              <Text style={styles.metadataText}>Author: {thesis?.author || 'Unknown Author'}</Text>
            </View>
            <View key="college" style={styles.metadataItem}>
              <Icon name="school" size={16} color="#666" />
              <Text style={styles.metadataText}>College: {thesis?.college_department || thesis?.college || 'Unknown College'}</Text>
            </View>
            <View key="batch" style={styles.metadataItem}>
              <Icon name="calendar" size={16} color="#666" />
              <Text style={styles.metadataText}>Batch: {thesis?.batch || thesis?.year || 'N/A'}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Abstract</Text>
          <ScrollView style={styles.abstractContainer}>
            <Text style={styles.abstractText}>
              {thesis?.abstract || thesis?.description || 'No abstract available for this thesis.'}
            </Text>
          </ScrollView>

          {/* Action Buttons - Only View Button for Approved Access */}
          <View style={styles.buttonsContainer}>
            {accessStatus === 'approved' ? (
              <>
                <TouchableOpacity 
                  style={styles.viewButton}
                  onPress={viewPdf}
                  disabled={isLoadingPdf}
                >
                  {isLoadingPdf ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Icon name="file-document" size={20} color="#FFFFFF" />
                  )}
                  <Text style={styles.viewButtonText}>
                    {isLoadingPdf ? 'Loading...' : 'View Full Thesis'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.securityNote}>
                  <Icon name="shield-check" size={14} color="#28a745" />
                  {' '}Thesis will open in secure streaming viewer with downloads disabled
                </Text>
              </>
            ) : (
              <View style={styles.noAccessContainer}>
                <Icon name="lock" size={48} color="#6c757d" />
                <Text style={styles.noAccessTitle}>Access Required</Text>
                <Text style={styles.noAccessMessage}>
                  You need approved access to view this thesis. Please go back to the previous screen to request access.
                </Text>
                <TouchableOpacity 
                  style={styles.backToDetailsButton}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.backToDetailsText}>Back to Thesis Details</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Request Status Info */}
            {requestData && (accessStatus === 'pending' || accessStatus === 'approved' || accessStatus === 'denied') && (
              <View style={styles.requestInfo}>
                <Text style={styles.requestInfoTitle}>Request Details:</Text>
                <Text style={styles.requestInfoText}>
                  Submitted: {new Date(requestData.request_date).toLocaleDateString()}
                </Text>
                <Text style={styles.requestInfoText}>
                  Status: {requestData.status.toUpperCase()}
                </Text>
                {accessStatus === 'approved' && requestData.expiryDate && (
                  <Text style={styles.requestInfoText}>
                    Expires: {new Date(requestData.expiryDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 80,
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingTop: 30,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5.84,
    elevation: 8,
  },
  backButton: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  securityWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#343a40',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  securityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  statusTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusMessage: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  mainContent: {
    flex: 1,
    padding: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 80,
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  modalCloseButton: {
    padding: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  pdfControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc3545',
    marginHorizontal: 5,
  },
  controlTextDisabled: {
    color: '#999',
  },
  pageInfo: {
    alignItems: 'center',
  },
  pageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  securityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4edda',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  securityStatusText: {
    color: '#155724',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  pdfContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  pdf: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  pdfLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  pdfLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc3545',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  errorButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 300,
  },
  retryButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  thesisContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5.84,
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  thesisTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    lineHeight: 28,
    textAlign: 'center',
  },
  metadataContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metadataText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#dc3545',
  },
  abstractContainer: {
    marginBottom: 20,
    maxHeight: 200,
  },
  abstractText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    textAlign: 'justify',
  },
  buttonsContainer: {
    marginTop: 20,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  securityNote: {
    fontSize: 12,
    color: '#28a745',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  requestInfo: {
    backgroundColor: '#e9ecef',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
  },
  requestInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 8,
  },
  requestInfoText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  noAccessContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginVertical: 10,
  },
  noAccessTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6c757d',
    marginTop: 10,
    marginBottom: 8,
  },
  noAccessMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 20,
  },
  backToDetailsButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backToDetailsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default FullViewThesisScreen;