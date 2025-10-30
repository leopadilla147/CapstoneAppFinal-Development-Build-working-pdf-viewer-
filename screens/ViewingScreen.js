  import React, { useState, useEffect } from 'react';
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
    RefreshControl,
    Dimensions
  } from 'react-native';
  import { SafeAreaView } from 'react-native-safe-area-context';
  import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
  import QRCode from 'react-native-qrcode-svg';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { thesisService } from '../services/thesisService';

  const { width, height } = Dimensions.get('window');

  // Responsive sizing
  const responsiveSize = (size) => Math.round((width / 375) * size);
  const responsiveHeight = (size) => Math.round((height / 812) * size);

  const ViewingScreen = ({ navigation, route }) => {
    const { thesis } = route.params;
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrData, setQrData] = useState(null);
    const [thesisData, setThesisData] = useState(thesis);
    const [accessStatus, setAccessStatus] = useState('none');
    const [requestData, setRequestData] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
      loadUserData();
      console.log('Received thesis data:', thesis);
    }, [thesis]);

    useEffect(() => {
      if (currentUser) {
        checkAccessStatus();
      }
    }, [currentUser]);

    const debugUserData = (user) => {
      console.log('🔍 USER DATA STRUCTURE:');
      console.log('Raw user object:', user);
      console.log('Available keys:', Object.keys(user));
      console.log('user.id:', user?.id);
      console.log('user.user_id:', user?.user_id);
      console.log('user.email:', user?.email);
      console.log('user.full_name:', user?.full_name);
    };

    const onRefresh = React.useCallback(async () => {
      setRefreshing(true);
      await checkAccessStatus();
      setRefreshing(false);
    }, [currentUser]);

    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          setCurrentUser(user);
          debugUserData(user); // Add this line
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    const checkAccessStatus = async () => {
      if (!currentUser) {
        console.log('No current user available');
        return;
      }

      try {
        const thesisId = thesis.thesis_id || thesis.id;
        
        // Validate user ID - check both possible field names
        const userId = currentUser.user_id || currentUser.id;
        
        if (!userId || !thesisId) {
          console.error('❌ Missing user ID or thesis ID:', { userId, thesisId, currentUser, thesis });
          setAccessStatus('none');
          return;
        }

        console.log('✅ Checking access with:', { userId, thesisId });

        const userBorrowingStatus = await thesisService.getUserBorrowingStatus(userId, thesisId);
        
        setRequestData(userBorrowingStatus);
        
        if (userBorrowingStatus.error) {
          console.error('❌ Error in borrowing status:', userBorrowingStatus.error);
          setAccessStatus('none');
        } else if (userBorrowingStatus.status === 'approved' && !userBorrowingStatus.isExpired) {
          setAccessStatus('approved');
        } else if (userBorrowingStatus.status === 'approved' && userBorrowingStatus.isExpired) {
          setAccessStatus('expired');
        } else if (userBorrowingStatus.status === 'pending') {
          setAccessStatus('pending');
        } else if (userBorrowingStatus.status === 'denied') {
          setAccessStatus('denied');
        } else {
          setAccessStatus('none');
        }
      } catch (error) {
        console.error('❌ Error checking access status:', error);
        setAccessStatus('none');
      }
    };

    const handleRequestAccess = async () => {
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to request access.');
        return;
      }

      if (isNavigating) return;

      const thesisId = thesisData.thesis_id || thesisData.id;
      
      if (!thesisId) {
        Alert.alert('Error', 'Thesis ID not found.');
        return;
      }

      setIsNavigating(true);
      setLoading(true);
      
      try {
        await thesisService.requestAccess(currentUser.user_id, thesisId);
        Alert.alert(
          'Request Submitted', 
          'Your request for access has been submitted to the administrator. You will be notified when it is approved.',
          [{ 
            text: 'OK',
            onPress: () => {
              setAccessStatus('pending');
              checkAccessStatus();
            }
          }]
        );
      } catch (error) {
        console.error('Error requesting access:', error);
        
        let errorMessage = 'Failed to submit request. Please try again.';
        if (error.message.includes('already have a pending request')) {
          errorMessage = 'You already have a pending request for this thesis.';
          setAccessStatus('pending');
        }
        
        Alert.alert('Request Failed', errorMessage);
      } finally {
        setLoading(false);
        setIsNavigating(false);
      }
    };

    const handleBorrow = async () => {
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to borrow from smart bookshelf.');
        return;
      }

      const thesisId = thesis.thesis_id || thesis.id;
      
      if (!thesisId) {
        Alert.alert('Error', 'Thesis ID not found. Cannot generate borrow QR.');
        return;
      }

      const availableCopies = thesis.available_copies !== undefined ? thesis.available_copies : 1;
      if (availableCopies <= 0) {
        Alert.alert(
          'Not Available',
          'Sorry, all copies of this thesis are currently borrowed. Please try again later.'
        );
        return;
      }

      setLoading(true);
      try {
        // Simple QR data - only thesis_id and user_id
        const userId = currentUser.user_id || currentUser.id;
        const simpleQRData = {
          thesis_id: thesisId,
          user_id: userId
        };
        
        setQrData(simpleQRData);
        setShowQRModal(true);
      } catch (error) {
        console.error('Error creating borrow QR:', error);
        Alert.alert(
          'Borrow Error', 
          error.message || 'Failed to generate borrow QR code. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    // Safe data access with fallbacks
    const getThesisTitle = () => {
      return thesisData?.title || 'No Title Available';
    };

    const getThesisAuthor = () => {
      return thesisData?.author || 'Unknown Author';
    };

    const getThesisCollege = () => {
      return thesisData?.college_department || thesisData?.college || 'Unknown College';
    };

    const getThesisBatch = () => {
      return thesisData?.batch || thesisData?.year || 'N/A';
    };

    const getThesisAbstract = () => {
      return thesisData?.abstract || thesisData?.description || 'No abstract available for this thesis.';
    };

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#dc3545" />

        {/* Responsive Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={responsiveSize(24)} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thesis Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Main Content */}
        <ScrollView 
          style={styles.mainContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#dc3545']}
              tintColor="#dc3545"
            />
          }
        >
          <Text style={styles.welcomeText}>Welcome, {currentUser?.full_name || currentUser?.fullName || 'Student'}</Text>
          <Text style={styles.viewingText}>Viewing Thesis</Text>

          {/* Thesis Details */}
          <View style={styles.thesisContainer}>
            <Text style={styles.thesisTitle}>{getThesisTitle()}</Text>
            
            {/* Thesis Metadata */}
            <View style={styles.metadataContainer}>
              <View style={styles.metadataItem}>
                <Icon name="account" size={responsiveSize(16)} color="#666" />
                <Text style={styles.metadataText}>Author: {getThesisAuthor()}</Text>
              </View>
              <View style={styles.metadataItem}>
                <Icon name="school" size={responsiveSize(16)} color="#666" />
                <Text style={styles.metadataText}>College: {getThesisCollege()}</Text>
              </View>
              <View style={styles.metadataItem}>
                <Icon name="calendar" size={responsiveSize(16)} color="#666" />
                <Text style={styles.metadataText}>Batch: {getThesisBatch()}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Abstract</Text>
            <ScrollView style={styles.abstractContainer}>
              <Text style={styles.abstractText}>
                {getThesisAbstract()}
              </Text>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.buttonsContainer}>
              {accessStatus === 'approved' ? (
                <TouchableOpacity 
                  style={styles.viewButton}
                  onPress={() => navigation.navigate('FullViewThesisScreen', { thesis: thesisData })}
                >
                  <Icon name="file-document" size={responsiveSize(20)} color="#FFFFFF" />
                  <Text style={styles.viewButtonText}>View Full Thesis</Text>
                </TouchableOpacity>
              ) : accessStatus === 'pending' ? (
                <TouchableOpacity 
                  style={[styles.requestButton, styles.buttonDisabled]}
                  disabled={true}
                >
                  <Icon name="clock" size={responsiveSize(20)} color="#FFFFFF" />
                  <Text style={styles.requestButtonText}>Request Pending</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.requestButton, loading && styles.buttonDisabled]}
                  onPress={handleRequestAccess}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Icon name="lock-open" size={responsiveSize(20)} color="#FFFFFF" />
                  )}
                  <Text style={styles.requestButtonText}>
                    {loading ? 'Requesting...' : 'Request Access'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Borrow Button - Only enabled when approved */}
              <TouchableOpacity 
                style={[
                  styles.borrowButton, 
                  (accessStatus !== 'approved' || loading) && styles.buttonDisabled
                ]}
                onPress={handleBorrow}
                disabled={accessStatus !== 'approved' || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Icon name="bookshelf" size={responsiveSize(20)} color="#FFFFFF" />
                )}
                <Text style={styles.borrowButtonText}>
                  {loading ? 'Generating...' : 'Borrow from Smart Bookshelf'}
                </Text>
              </TouchableOpacity>

              {/* Request Status Info */}
              {requestData && (accessStatus === 'pending' || accessStatus === 'approved' || accessStatus === 'denied') && (
                <View style={styles.requestInfo}>
                  <Text style={styles.requestInfoTitle}>Request Details:</Text>
                  <Text style={styles.requestInfoText}>
                    Submitted: {new Date(requestData.request_date).toLocaleDateString()}
                  </Text>
                  <Text style={styles.requestInfoText}>
                    Status: {requestData.status?.toUpperCase()}
                  </Text>
                  {accessStatus === 'approved' && requestData.remove_access_date && (
                    <Text style={styles.requestInfoText}>
                      Expires: {new Date(requestData.remove_access_date).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* QR Code Modal */}
        <Modal
          visible={showQRModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowQRModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.qrModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Borrow QR Code</Text>
                <TouchableOpacity 
                  onPress={() => setShowQRModal(false)}
                  style={styles.closeModalButton}
                >
                  <Icon name="close" size={responsiveSize(24)} color="#333" />
                </TouchableOpacity>
              </View>

              <View style={styles.qrContainer}>
                {qrData && (
                  <>
                    <ScrollView 
                      style={styles.qrScrollView}
                      maximumZoomScale={3.0}
                      minimumZoomScale={1.0}
                      contentContainerStyle={styles.qrContentContainer}
                    >
                      <QRCode
                        value={`${qrData.thesis_id}:${qrData.user_id}`}
                        size={responsiveSize(280)} // Increased size for better zooming
                      />
                    </ScrollView>
                    <Text style={styles.qrInstruction}>
                      Present this QR code to the Smart Bookshelf camera
                    </Text>
                    <Text style={styles.qrDetails}>
                      Thesis: {getThesisTitle()}{'\n'}
                      User: {currentUser?.full_name || currentUser?.fullName || 'Unknown'}
                    </Text>
                    <Text style={styles.qrZoomHint}>
                      Pinch to zoom QR code
                    </Text>
                  </>
                )}
              </View>

              <TouchableOpacity 
                style={styles.doneButton}
                onPress={() => setShowQRModal(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: responsiveHeight(60),
      backgroundColor: '#dc3545',
      paddingHorizontal: responsiveSize(16),
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
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
    mainContent: {
      flex: 1,
      padding: responsiveSize(16),
    },
    welcomeText: {
      fontSize: responsiveSize(20),
      fontWeight: 'bold',
      marginBottom: responsiveSize(8),
      color: '#333',
      textAlign: 'center',
    },
    viewingText: {
      fontSize: responsiveSize(18),
      fontWeight: '600',
      marginBottom: responsiveSize(24),
      color: '#666',
      textAlign: 'center',
    },
    thesisContainer: {
      flex: 1,
      backgroundColor: '#fff',
      borderRadius: responsiveSize(12),
      padding: responsiveSize(16),
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
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
    requestButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#dc3545',
      paddingVertical: responsiveSize(12),
      borderRadius: responsiveSize(8),
      marginBottom: responsiveSize(12),
    },
    borrowButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#28a745',
      paddingVertical: responsiveSize(12),
      borderRadius: responsiveSize(8),
    },
    viewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#007bff',
      paddingVertical: responsiveSize(12),
      borderRadius: responsiveSize(8),
      marginBottom: responsiveSize(12),
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    requestButtonText: {
      color: '#fff',
      fontSize: responsiveSize(16),
      fontWeight: 'bold',
      marginLeft: responsiveSize(8),
    },
    borrowButtonText: {
      color: '#fff',
      fontSize: responsiveSize(16),
      fontWeight: 'bold',
      marginLeft: responsiveSize(8),
    },
    viewButtonText: {
      color: '#fff',
      fontSize: responsiveSize(16),
      fontWeight: 'bold',
      marginLeft: responsiveSize(8),
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: responsiveSize(20),
    },
    qrModal: {
      backgroundColor: '#fff',
      borderRadius: responsiveSize(12),
      padding: responsiveSize(20),
      width: '100%',
      maxWidth: responsiveSize(400),
      maxHeight: '80%', // Limit modal height
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: responsiveSize(16),
    },
    modalTitle: {
      fontSize: responsiveSize(18),
      fontWeight: 'bold',
      color: '#333',
    },
    closeModalButton: {
      padding: responsiveSize(4),
    },
    qrContainer: {
      alignItems: 'center',
      marginBottom: responsiveSize(16),
    },
    qrScrollView: {
      width: responsiveSize(300),
      height: responsiveSize(300),
      backgroundColor: '#f8f9fa',
      borderRadius: responsiveSize(10),
    },
    qrContentContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    qrInstruction: {
      fontSize: responsiveSize(16),
      fontWeight: '600',
      color: '#333',
      marginTop: responsiveSize(16),
      textAlign: 'center',
    },
    qrDetails: {
      fontSize: responsiveSize(14),
      color: '#666',
      marginTop: responsiveSize(8),
      textAlign: 'center',
      lineHeight: responsiveSize(20),
    },
    qrZoomHint: {
      fontSize: responsiveSize(12),
      color: '#999',
      marginTop: responsiveSize(6),
      fontStyle: 'italic',
      textAlign: 'center',
    },
    doneButton: {
      backgroundColor: '#dc3545',
      paddingVertical: responsiveSize(12),
      borderRadius: responsiveSize(8),
      alignItems: 'center',
    },
    doneButtonText: {
      color: '#fff',
      fontSize: responsiveSize(16),
      fontWeight: 'bold',
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
  });

  export default ViewingScreen;