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
  Platform,
  ImageBackground
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Pdf from 'react-native-pdf';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { thesisService } from '../services/thesisService';

// Import only expo-screen-capture (available in Expo)
import * as ScreenCapture from 'expo-screen-capture';

const { width, height } = Dimensions.get('window');

// Responsive sizing
const responsiveSize = (size) => Math.round((width / 375) * size);
const responsiveHeight = (size) => Math.round((height / 812) * size);

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfKey, setPdfKey] = useState(0);
  
  const pdfRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const totalPagesRef = useRef(0); // Add this ref to preserve total pages

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

  // Update the ref whenever totalPages changes
  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

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
    setCurrentPage(1);
    setTotalPages(0);
    totalPagesRef.current = 0; // Reset ref too
    setPdfLoadingProgress(0);
    setPdfKey(prev => prev + 1);
  };

  const handlePdfLoadComplete = (numberOfPages) => {
    console.log(`✅ PDF loaded successfully: ${numberOfPages} pages`);
    setTotalPages(numberOfPages);
    totalPagesRef.current = numberOfPages; // Update ref
    setCurrentPage(1);
    setPdfLoadError(false);
  };

  const handlePdfError = (error) => {
    console.error('❌ PDF loading error:', error);
    setPdfLoadError(true);
  };

  const handlePageChanged = (page, numberOfPages) => {
    console.log(`📄 Page changed: ${page} of ${numberOfPages}`);
    setCurrentPage(page);
    // Also update total pages if different
    if (numberOfPages !== totalPages) {
      setTotalPages(numberOfPages);
      totalPagesRef.current = numberOfPages;
    }
  };

  // FIXED: Use the ref for totalPages to ensure it doesn't get lost
  const goToNextPage = () => {
    const currentTotalPages = totalPagesRef.current;
    if (currentPage < currentTotalPages) {
      const nextPage = currentPage + 1;
      console.log(`➡️ Navigating to next page: ${nextPage} of ${currentTotalPages}`);
      setCurrentPage(nextPage);
      setPdfKey(prev => prev + 1);
    } else {
      console.log(`ℹ️ Already at last page: ${currentPage} of ${currentTotalPages}`);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      console.log(`⬅️ Navigating to previous page: ${prevPage} of ${totalPagesRef.current}`);
      setCurrentPage(prevPage);
      setPdfKey(prev => prev + 1);
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
        <ImageBackground 
          source={require('../assets/origbg1.png')} 
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Checking access permissions...</Text>
          </View>
        </ImageBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ImageBackground 
        source={require('../assets/origbg1.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Responsive Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={responsiveSize(24)} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Full Thesis View</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Security Warning */}
        <View style={styles.securityWarning}>
          <Icon name="shield-lock" size={responsiveSize(16)} color="#fff" />
          <Text style={styles.securityText}>
            🔒 Protected Content - Screenshots are disabled
          </Text>
        </View>

        {/* Access Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusInfo.color }]}>
          <Icon name={statusInfo.icon} size={responsiveSize(20)} color="#FFFFFF" />
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
                <Icon name="close" size={responsiveSize(24)} color="#FFFFFF" />
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
                <Icon name="chevron-left" size={responsiveSize(24)} color={currentPage <= 1 ? "#999" : "#dc3545"} />
                <Text style={[styles.controlText, currentPage <= 1 && styles.controlTextDisabled]}>
                  Previous
                </Text>
              </TouchableOpacity>

              <View style={styles.pageInfo}>
                <Text style={styles.pageText}>
                  Page {currentPage} of {totalPages || totalPagesRef.current || '?'}
                </Text>
                <Text style={styles.pageDebug}>
                  Total Pages: {totalPagesRef.current}
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.controlButton, currentPage >= (totalPages || totalPagesRef.current) && styles.controlButtonDisabled]}
                onPress={goToNextPage}
                disabled={currentPage >= (totalPages || totalPagesRef.current)}
              >
                <Text style={[styles.controlText, currentPage >= (totalPages || totalPagesRef.current) && styles.controlTextDisabled]}>
                  Next
                </Text>
                <Icon name="chevron-right" size={responsiveSize(24)} color={currentPage >= (totalPages || totalPagesRef.current) ? "#999" : "#dc3545"} />
              </TouchableOpacity>
            </View>

            {/* Security Status */}
            <View style={styles.securityStatus}>
              <Icon name="shield-check" size={responsiveSize(16)} color="#28a745" />
              <Text style={styles.securityStatusText}>
                🔒 Secure Streaming - Downloads are disabled
              </Text>
            </View>

            {pdfUrl && !pdfLoadError ? (
              <View style={styles.pdfContainer}>
                <Pdf
                  key={`${pdfKey}-${currentPage}`}
                  ref={pdfRef}
                  source={{ 
                    uri: pdfUrl,
                    cache: false,
                  }}
                  page={currentPage}
                  style={styles.pdf}
                  onLoadComplete={handlePdfLoadComplete}
                  onPageChanged={handlePageChanged}
                  onError={handlePdfError}
                  onPressLink={(uri) => {
                    console.log(`Link pressed: ${uri}`);
                    Alert.alert('Security Notice', 'External links are disabled in secure mode.');
                  }}
                  enablePaging={true}
                  enableRTL={false}
                  enableAnnotationRendering={false}
                  fitPolicy={0}
                  trustAllCerts={Platform.OS === 'ios'}
                  spacing={10}
                  minScale={1.0}
                  maxScale={3.0}
                  activityIndicator={
                    <View style={styles.pdfLoading}>
                      <ActivityIndicator size="large" color="#dc3545" />
                      <Text style={styles.pdfLoadingText}>Loading secure thesis document...</Text>
                    </View>
                  }
                />
                
                {/* Page Overlay */}
                <View style={styles.pageOverlay}>
                  <Text style={styles.pageOverlayText}>
                    Page {currentPage} of {totalPages || totalPagesRef.current || '?'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={responsiveSize(48)} color="#dc3545" />
                <Text style={styles.errorTitle}>Failed to Load PDF</Text>
                <Text style={styles.errorMessage}>
                  {pdfLoadError 
                    ? 'The thesis document could not be loaded. Please try again later.'
                    : 'Preparing document...'
                  }
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
                <Icon name="account" size={responsiveSize(16)} color="#666" />
                <Text style={styles.metadataText}>Author: {thesis?.author || 'Unknown Author'}</Text>
              </View>
              <View key="college" style={styles.metadataItem}>
                <Icon name="school" size={responsiveSize(16)} color="#666" />
                <Text style={styles.metadataText}>College: {thesis?.college_department || thesis?.college || 'Unknown College'}</Text>
              </View>
              <View key="batch" style={styles.metadataItem}>
                <Icon name="calendar" size={responsiveSize(16)} color="#666" />
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
                      <Icon name="file-document" size={responsiveSize(20)} color="#FFFFFF" />
                    )}
                    <Text style={styles.viewButtonText}>
                      {isLoadingPdf ? 'Loading...' : 'View Full Thesis'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.securityNote}>
                    <Icon name="shield-check" size={responsiveSize(14)} color="#28a745" />
                    {' '}Thesis will open in secure streaming viewer with downloads disabled
                  </Text>
                </>
              ) : (
                <View style={styles.noAccessContainer}>
                  <Icon name="lock" size={responsiveSize(48)} color="#6c757d" />
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
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: responsiveSize(16),
    fontSize: responsiveSize(16),
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: responsiveHeight(60),
    backgroundColor: '#dc3545',
    paddingHorizontal: responsiveSize(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButton: {
    padding: responsiveSize(4),
  },
  headerTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: responsiveSize(40),
  },
  securityWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#343a40',
    paddingVertical: responsiveSize(8),
    paddingHorizontal: responsiveSize(16),
  },
  securityText: {
    color: '#fff',
    fontSize: responsiveSize(12),
    fontWeight: 'bold',
    marginLeft: responsiveSize(8),
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSize(16),
    margin: responsiveSize(16),
    borderRadius: responsiveSize(8),
  },
  statusTextContainer: {
    marginLeft: responsiveSize(12),
    flex: 1,
  },
  statusTitle: {
    color: '#fff',
    fontSize: responsiveSize(16),
    fontWeight: 'bold',
    marginBottom: responsiveSize(4),
  },
  statusMessage: {
    color: '#fff',
    fontSize: responsiveSize(14),
    opacity: 0.9,
  },
  mainContent: {
    flex: 1,
    padding: responsiveSize(16),
    backgroundColor: 'transparent',
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
    height: responsiveHeight(60),
    backgroundColor: '#dc3545',
    paddingHorizontal: responsiveSize(16),
  },
  modalCloseButton: {
    padding: responsiveSize(4),
  },
  modalTitle: {
    fontSize: responsiveSize(16),
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: responsiveSize(10),
  },
  pdfControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSize(16),
    paddingVertical: responsiveSize(10),
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSize(15),
    paddingVertical: responsiveSize(8),
    borderRadius: responsiveSize(6),
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlText: {
    fontSize: responsiveSize(14),
    fontWeight: '600',
    color: '#dc3545',
    marginHorizontal: responsiveSize(5),
  },
  controlTextDisabled: {
    color: '#999',
  },
  pageInfo: {
    alignItems: 'center',
  },
  pageText: {
    fontSize: responsiveSize(14),
    fontWeight: '600',
    color: '#495057',
  },
  securityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4edda',
    paddingVertical: responsiveSize(8),
    paddingHorizontal: responsiveSize(16),
  },
  securityStatusText: {
    color: '#155724',
    fontSize: responsiveSize(12),
    fontWeight: 'bold',
    marginLeft: responsiveSize(8),
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
    marginTop: responsiveSize(16),
    fontSize: responsiveSize(16),
    color: '#666',
  },
  progressText: {
    marginTop: responsiveSize(8),
    fontSize: responsiveSize(14),
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: responsiveSize(20),
  },
  errorTitle: {
    fontSize: responsiveSize(20),
    fontWeight: 'bold',
    color: '#dc3545',
    marginTop: responsiveSize(16),
    marginBottom: responsiveSize(16),
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: responsiveSize(16),
    color: '#666',
    textAlign: 'center',
    marginBottom: responsiveSize(30),
    lineHeight: responsiveSize(22),
  },
  errorButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: responsiveSize(300),
  },
  retryButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: responsiveSize(20),
    paddingVertical: responsiveSize(12),
    borderRadius: responsiveSize(8),
    flex: 1,
    marginRight: responsiveSize(10),
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: responsiveSize(20),
    paddingVertical: responsiveSize(12),
    borderRadius: responsiveSize(8),
    flex: 1,
    marginLeft: responsiveSize(10),
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: responsiveSize(16),
    fontWeight: 'bold',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: responsiveSize(16),
    fontWeight: 'bold',
  },
  thesisContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: responsiveSize(12),
    padding: responsiveSize(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderLeftWidth: responsiveSize(4),
    borderLeftColor: '#dc3545',
  },
  thesisTitle: {
    fontSize: responsiveSize(20),
    fontWeight: 'bold',
    marginBottom: responsiveSize(16),
    color: '#333',
    lineHeight: responsiveSize(24),
    textAlign: 'center',
  },
  metadataContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: responsiveSize(8),
    padding: responsiveSize(12),
    marginBottom: responsiveSize(16),
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSize(6),
  },
  metadataText: {
    fontSize: responsiveSize(14),
    color: '#666',
    marginLeft: responsiveSize(8),
  },
  sectionTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    marginBottom: responsiveSize(12),
    color: '#dc3545',
  },
  abstractContainer: {
    marginBottom: responsiveSize(16),
    maxHeight: responsiveHeight(200),
  },
  abstractText: {
    fontSize: responsiveSize(14),
    lineHeight: responsiveSize(20),
    color: '#333',
    textAlign: 'justify',
  },
  buttonsContainer: {
    marginTop: responsiveSize(16),
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: responsiveSize(12),
    borderRadius: responsiveSize(8),
    marginBottom: responsiveSize(10),
  },
  viewButtonText: {
    color: '#fff',
    fontSize: responsiveSize(16),
    fontWeight: 'bold',
    marginLeft: responsiveSize(8),
  },
  securityNote: {
    fontSize: responsiveSize(12),
    color: '#28a745',
    textAlign: 'center',
    marginBottom: responsiveSize(12),
    fontStyle: 'italic',
    lineHeight: responsiveSize(16),
  },
  requestInfo: {
    backgroundColor: '#e9ecef',
    padding: responsiveSize(12),
    borderRadius: responsiveSize(8),
    marginTop: responsiveSize(12),
  },
  requestInfoTitle: {
    fontSize: responsiveSize(14),
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: responsiveSize(6),
  },
  requestInfoText: {
    fontSize: responsiveSize(12),
    color: '#6c757d',
    marginBottom: responsiveSize(4),
  },
  noAccessContainer: {
    alignItems: 'center',
    padding: responsiveSize(16),
    backgroundColor: '#f8f9fa',
    borderRadius: responsiveSize(8),
    marginVertical: responsiveSize(8),
  },
  noAccessTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#6c757d',
    marginTop: responsiveSize(8),
    marginBottom: responsiveSize(6),
  },
  noAccessMessage: {
    fontSize: responsiveSize(14),
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: responsiveSize(12),
    lineHeight: responsiveSize(20),
  },
  backToDetailsButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: responsiveSize(16),
    paddingVertical: responsiveSize(8),
    borderRadius: responsiveSize(6),
  },
  backToDetailsText: {
    color: '#fff',
    fontSize: responsiveSize(14),
    fontWeight: 'bold',
  },
  pageOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: responsiveSize(12),
    paddingVertical: responsiveSize(6),
    borderRadius: responsiveSize(4),
  },
  pageOverlayText: {
    color: '#FFFFFF',
    fontSize: responsiveSize(12),
    fontWeight: 'bold',
  },
  pageDebug: {
    fontSize: responsiveSize(8),
    color: '#666',
    marginTop: 2,
  },
});

export default FullViewThesisScreen;