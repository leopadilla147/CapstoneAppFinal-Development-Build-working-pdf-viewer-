import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { thesisService } from '../services/thesisService';

const { width } = Dimensions.get('window');

const QRScannerScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [cameraActive, setCameraActive] = useState(true);
  const isFocused = useIsFocused();
  const cameraRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    loadUserData();
    initializeCamera();
    
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isFocused) {
      setCameraActive(true);
      setScanned(false);
      setLoading(false);
      isProcessingRef.current = false;
    } else {
      setCameraActive(false);
    }
  }, [isFocused]);

  const initializeCamera = async () => {
    try {
      if (!permission?.granted) {
        await requestPermission();
      }
    } catch (error) {
      console.error('Error initializing camera:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleBarCodeScanned = useCallback(async ({ data }) => {
    if (scanned || !currentUser || isProcessingRef.current) {
      console.log('Scan prevented - already processing or scanned');
      return;
    }

    setScanned(true);
    isProcessingRef.current = true;
    setLoading(true);

    try {
      console.log('🔍 Raw QR data:', data);
      
      // Use the new processQRCodeData function that handles all formats
      const thesis = await thesisService.processQRCodeData(data);

      if (thesis) {
        console.log('✅ Thesis found:', thesis.title);
        
        // Record the scan in user_recent_scanned table
        try {
          await thesisService.recordUserScan(currentUser.user_id, thesis.thesis_id);
          console.log('📝 Scan recorded successfully');
        } catch (scanError) {
          console.log('⚠️ Non-critical error recording scan:', scanError);
          // Continue even if scan recording fails
        }
        
        // Navigate to ViewingScreen with the thesis data
        navigation.navigate('Viewing', { thesis });
        
        // Reset scan state after navigation with delay
        scanTimeoutRef.current = setTimeout(() => {
          setScanned(false);
          setLoading(false);
          isProcessingRef.current = false;
        }, 2000);
      } else {
        throw new Error('No thesis found for this QR code');
      }

    } catch (error) {
      console.error('❌ Error processing QR code:', error);
      
      let errorTitle = 'Scan Error';
      let errorMessage = 'Could not process the QR code. Please try again.';
      let resetDelay = 3000;

      if (error.message.includes('No thesis found')) {
        errorTitle = 'Thesis Not Found';
        errorMessage = 'No thesis found for this QR code. The thesis may have been removed or the QR code is invalid.';
      } else if (error.message.includes('Invalid thesis ID') || error.message.includes('QR code does not contain valid thesis information')) {
        errorTitle = 'Invalid QR Code';
        errorMessage = 'This QR code is not a valid thesis QR code. Please scan a thesis QR code.';
      } else if (error.message.includes('Database error')) {
        errorTitle = 'Database Error';
        errorMessage = 'There was a problem accessing the database. Please check your connection and try again.';
      }

      Alert.alert(errorTitle, errorMessage, [
        {
          text: 'OK',
          onPress: () => {
            scanTimeoutRef.current = setTimeout(() => {
              setScanned(false);
              setLoading(false);
              isProcessingRef.current = false;
            }, resetDelay);
          }
        }
      ]);
    }
  }, [scanned, currentUser, navigation]);

  const handleRescan = () => {
    setScanned(false);
    setLoading(false);
    isProcessingRef.current = false;
  };

  const handleRequestPermission = async () => {
    try {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to scan QR codes. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {} } // You can add deep linking to settings here
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
    }
  };

  // Permission states
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.permissionText}>Checking camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Icon name="camera-off" size={64} color="#999" />
          <Text style={styles.permissionText}>Camera Access Required</Text>
          <Text style={styles.permissionSubtext}>
            QR code scanning requires camera access. Please grant permission to continue.
          </Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={handleRequestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        {isFocused && cameraActive && permission.granted ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'pdf417'],
            }}
            facing="back"
          >
            <View style={styles.overlay}>
              <View style={styles.scanFrame}>
                {/* Top Left Corner */}
                <View style={[styles.corner, styles.cornerTL]} />
                {/* Top Right Corner */}
                <View style={[styles.corner, styles.cornerTR]} />
                {/* Bottom Left Corner */}
                <View style={[styles.corner, styles.cornerBL]} />
                {/* Bottom Right Corner */}
                <View style={[styles.corner, styles.cornerBR]} />
                
                {/* Animated scanning line */}
                <View style={styles.scanLine} />
              </View>
              
              <Text style={styles.scanText}>
                Align QR code within the frame
              </Text>
            </View>
          </CameraView>
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Icon name="camera-off" size={64} color="#666" />
            <Text style={styles.placeholderText}>
              {!isFocused ? 'Camera paused' : 'Camera not available'}
            </Text>
          </View>
        )}

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Processing QR Code...</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Point your camera at a thesis QR code to scan
        </Text>
        
        {scanned && !loading && (
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={handleRescan}
          >
            <Icon name="camera" size={20} color="#FFFFFF" />
            <Text style={styles.rescanButtonText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 34,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'transparent',
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#dc3545',
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#dc3545',
    width: '100%',
    top: '50%',
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  scanText: {
    marginTop: 30,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
  },
  footer: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
  },
  footerText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 10,
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  rescanButtonText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 14,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    padding: 10,
  },
  manualButtonText: {
    color: '#666',
    marginLeft: 8,
    fontSize: 14,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionSubtext: {
    color: '#CCCCCC',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default QRScannerScreen;