import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  StatusBar, 
  Modal,
  Animated,
  ImageBackground,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { thesisService } from '../services/thesisService';

const { width, height } = Dimensions.get('window');

// Responsive sizing
const responsiveSize = (size) => Math.round((width / 375) * size);
const responsiveHeight = (size) => Math.round((height / 812) * size);

const HomeScreen = ({ navigation, onLogout }) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-300));
  const [currentUser, setCurrentUser] = useState(null);
  const [recentTheses, setRecentTheses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('student');

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadRecentTheses();
      checkUserRole();
    }
  }, [currentUser]);

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

  const checkUserRole = async () => {
    try {
      const role = await AsyncStorage.getItem('userRole');
      if (role) {
        setUserRole(role);
      }
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const loadRecentTheses = async () => {
    try {
      setLoading(true);
      if (currentUser?.user_id) {
        const recentThesesData = await thesisService.getRecentTheses(currentUser.user_id);
        setRecentTheses(recentThesesData);
      }
    } catch (error) {
      console.error('Error loading recent theses:', error);
      // Fallback sample data
      setRecentTheses([
        {
          thesis_id: 1,
          title: 'Machine Learning Applications in Healthcare',
          author: 'John Smith et al.',
          college_department: 'College of ICT',
          created_at: new Date().toISOString()
        },
        {
          thesis_id: 2,
          title: 'Blockchain Technology for Secure Voting Systems',
          author: 'Maria Garcia et al.',
          college_department: 'College of Engineering',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRecentTheses();
  };

  const handleThesisPress = (thesis) => {
    navigation.navigate('Viewing', { thesis });
  };

  const toggleMenu = () => {
    if (isMenuVisible) {
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setIsMenuVisible(false));
    } else {
      setIsMenuVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('userRole');
      
      if (onLogout) {
        onLogout();
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleNavigation = (screen) => {
    toggleMenu();
    navigation.navigate(screen);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ImageBackground 
        source={require('../assets/origbg1.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Responsive Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
            <Icon name="menu" size={responsiveSize(24)} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/logo-small.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Thesis Guard</Text>
          </View>
          
          <View style={styles.headerSpacer} />
        </View>

        {/* Mobile Navigation Menu Modal */}
        <Modal
          visible={isMenuVisible}
          transparent={true}
          animationType="none"
          onRequestClose={toggleMenu}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={toggleMenu}
          >
            <Animated.View 
              style={[
                styles.mobileMenu,
                {
                  transform: [{ translateX: slideAnim }]
                }
              ]}
            >
              <View style={styles.menuHeader}>
                <Image 
                  source={require('../assets/logo-small.png')} 
                  style={styles.menuLogo}
                  resizeMode="contain"
                />
                <Text style={styles.menuTitle}>Thesis Guard</Text>
                <TouchableOpacity onPress={toggleMenu} style={styles.closeButton}>
                  <Icon name="close" size={responsiveSize(24)} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.userInfo}>
                <Text style={styles.userName}>{currentUser?.full_name || 'User'}</Text>
                <Text style={styles.userRole}>{userRole === 'admin' ? 'Administrator' : 'Student'}</Text>
              </View>

              <View style={styles.menuItems}>
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => handleNavigation('Home')}
                >
                  <Icon name="home" size={responsiveSize(20)} color="#333" />
                  <Text style={styles.menuItemText}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => handleNavigation('Profile')}
                >
                  <Icon name="account" size={responsiveSize(20)} color="#333" />
                  <Text style={styles.menuItemText}>Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => handleNavigation('AccountSettings')}
                >
                  <Icon name="cog" size={responsiveSize(20)} color="#333" />
                  <Text style={styles.menuItemText}>Account Settings</Text>
                </TouchableOpacity>

                {userRole === 'admin' && (
                  <TouchableOpacity 
                    style={styles.menuItem}
                    onPress={() => handleNavigation('AdminDashboard')}
                  >
                    <Icon name="shield-account" size={responsiveSize(20)} color="#333" />
                    <Text style={styles.menuItemText}>Admin Dashboard</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={[styles.menuItem, styles.logoutButton]}
                  onPress={handleLogout}
                >
                  <Icon name="logout" size={responsiveSize(20)} color="#FFFFFF" />
                  <Text style={[styles.menuItemText, styles.logoutText]}>Log out</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Modal>

        {/* Main Content */}
        <ScrollView 
          style={styles.mainContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{currentUser?.full_name || 'Student'}</Text>
            <Text style={styles.welcomeSubtitle}>
              {userRole === 'admin' 
                ? 'Manage theses and user access requests' 
                : 'Access research papers and scan QR codes'
              }
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('QRScanner')}
            >
              <View style={styles.actionIconContainer}>
                <Icon name="qrcode-scan" size={responsiveSize(24)} color="#dc3545" />
              </View>
              <Text style={styles.actionText}>Scan QR</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <View style={styles.actionIconContainer}>
                <Icon name="account" size={responsiveSize(24)} color="#dc3545" />
              </View>
              <Text style={styles.actionText}>Profile</Text>
            </TouchableOpacity>

            {userRole === 'admin' && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('AdminDashboard')}
              >
                <View style={styles.actionIconContainer}>
                  <Icon name="shield-account" size={responsiveSize(24)} color="#dc3545" />
                </View>
                <Text style={styles.actionText}>Admin</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Recent Theses Section */}
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.recentTitle}>Recently Accessed</Text>
            </View>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#dc3545" />
                <Text style={styles.loadingText}>Loading recent theses...</Text>
              </View>
            ) : (
              <View style={styles.recentList}>
                {recentTheses.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Icon name="book-open" size={responsiveSize(40)} color="#999" />
                    <Text style={styles.emptyStateText}>No recent theses</Text>
                    <Text style={styles.emptyStateSubtext}>
                      {userRole === 'admin' 
                        ? 'Start managing theses from admin dashboard' 
                        : 'Scan QR codes to access theses'
                      }
                    </Text>
                  </View>
                ) : (
                  recentTheses.map((thesis, index) => (
                    <TouchableOpacity 
                      key={thesis.thesis_id}
                      style={styles.thesisItem}
                      onPress={() => handleThesisPress(thesis)}
                    >
                      <View style={styles.thesisNumber}>
                        <Text style={styles.thesisNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.thesisContent}>
                        <Text style={styles.thesisTitle} numberOfLines={2}>
                          {thesis.title}
                        </Text>
                        <Text style={styles.thesisAuthor} numberOfLines={1}>
                          by {thesis.author}
                        </Text>
                        <View style={styles.thesisMeta}>
                          <Text style={styles.thesisDepartment}>{thesis.college_department}</Text>
                          <Text style={styles.thesisDate}>{formatDate(thesis.created_at)}</Text>
                        </View>
                      </View>
                      <View style={styles.arrowContainer}>
                        <Icon name="chevron-right" size={responsiveSize(20)} color="#dc3545" />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
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
  menuButton: {
    padding: responsiveSize(4),
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: responsiveSize(30),
    height: responsiveSize(30),
    marginRight: responsiveSize(10),
  },
  headerTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: responsiveSize(40),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mobileMenu: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: responsiveSize(280),
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSize(20),
    paddingVertical: responsiveSize(16),
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#dc3545',
  },
  menuLogo: {
    width: responsiveSize(25),
    height: responsiveSize(25),
    marginRight: responsiveSize(10),
  },
  menuTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: responsiveSize(4),
  },
  menuItems: {
    paddingVertical: responsiveSize(10),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: responsiveSize(12),
    paddingHorizontal: responsiveSize(20),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: responsiveSize(16),
    color: '#333',
    marginLeft: responsiveSize(10),
  },
  logoutButton: {
    marginTop: responsiveSize(20),
    backgroundColor: '#dc3545',
    borderRadius: responsiveSize(8),
    marginHorizontal: responsiveSize(20),
    justifyContent: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    padding: responsiveSize(16),
    backgroundColor: 'transparent',
  },
  welcomeSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: responsiveSize(20),
    borderRadius: responsiveSize(12),
    marginBottom: responsiveSize(20),
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
  welcomeText: {
    fontSize: responsiveSize(24),
    fontWeight: '300',
    color: '#333',
    marginBottom: responsiveSize(5),
  },
  userName: {
    fontSize: responsiveSize(28),
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: responsiveSize(8),
  },
  welcomeSubtitle: {
    fontSize: responsiveSize(14),
    color: '#666',
    lineHeight: responsiveSize(20),
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: responsiveSize(24),
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: responsiveSize(5),
  },
  actionIconContainer: {
    width: responsiveSize(60),
    height: responsiveSize(60),
    backgroundColor: '#fff',
    borderRadius: responsiveSize(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: responsiveSize(8),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  actionText: {
    color: '#333',
    fontSize: responsiveSize(12),
    fontWeight: '600',
    textAlign: 'center',
  },
  recentSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSize(16),
  },
  recentTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: responsiveSize(40),
  },
  loadingText: {
    marginTop: responsiveSize(10),
    color: '#666',
    fontSize: responsiveSize(14),
  },
  recentList: {
    marginBottom: responsiveSize(10),
  },
  thesisItem: {
    backgroundColor: '#f8f9fa',
    padding: responsiveSize(12),
    borderRadius: responsiveSize(8),
    marginBottom: responsiveSize(10),
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 1.84,
    elevation: 2,
  },
  thesisNumber: {
    width: responsiveSize(30),
    height: responsiveSize(30),
    borderRadius: responsiveSize(15),
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSize(12),
  },
  thesisNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: responsiveSize(14),
  },
  thesisContent: {
    flex: 1,
  },
  thesisTitle: {
    fontSize: responsiveSize(14),
    fontWeight: '600',
    marginBottom: responsiveSize(4),
    color: '#333',
    lineHeight: responsiveSize(18),
  },
  thesisAuthor: {
    fontSize: responsiveSize(12),
    color: '#666',
    marginBottom: responsiveSize(6),
    fontStyle: 'italic',
  },
  thesisMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thesisDepartment: {
    fontSize: responsiveSize(11),
    color: '#dc3545',
    fontWeight: '500',
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    paddingHorizontal: responsiveSize(6),
    paddingVertical: responsiveSize(2),
    borderRadius: responsiveSize(4),
  },
  thesisDate: {
    fontSize: responsiveSize(11),
    color: '#999',
  },
  arrowContainer: {
    marginLeft: responsiveSize(8),
  },
  emptyState: {
    alignItems: 'center',
    padding: responsiveSize(40),
  },
  emptyStateText: {
    fontSize: responsiveSize(16),
    color: '#666',
    marginTop: responsiveSize(8),
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: responsiveSize(14),
    color: '#999',
    marginTop: responsiveSize(4),
    textAlign: 'center',
  },
  userInfo: {
    padding: responsiveSize(16),
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
  },
  userName: {
    fontSize: responsiveSize(16),
    fontWeight: 'bold',
    color: '#333',
  },
  userRole: {
    fontSize: responsiveSize(14),
    color: '#666',
    marginTop: responsiveSize(4),
  },
});

export default HomeScreen;