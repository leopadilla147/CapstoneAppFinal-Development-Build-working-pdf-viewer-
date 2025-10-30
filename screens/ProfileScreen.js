import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ImageBackground,
  ActivityIndicator,
  Modal,
  Animated,
  Image,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

const { width, height } = Dimensions.get('window');

// Responsive sizing
const responsiveSize = (size) => Math.round((width / 375) * size);
const responsiveHeight = (size) => Math.round((height / 812) * size);

const ProfileScreen = ({ navigation, onLogout }) => {
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [stats, setStats] = useState({
    papersViewed: 0,
    accessRequests: 0,
    bookshelfLogs: 0
  });
  const [loading, setLoading] = useState(true);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-300));
  const [userRole, setUserRole] = useState('student');

  useEffect(() => {
    fetchUserData();
    fetchRecentActivities();
    fetchUserStats();
    checkUserRole();
  }, []);

  const fetchUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUser(user);
        
        // Fetch complete user details with student info (without joins that cause errors)
        const { data: userDataFromDb, error } = await supabase
          .from('users')
          .select(`
            *,
            students (
              student_id,
              year_level,
              college_department,
              course
            )
          `)
          .eq('user_id', user.user_id)
          .single();

        if (error) {
          console.error('Error fetching user data:', error);
          return;
        }

        if (userDataFromDb) {
          setUserDetails(userDataFromDb);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
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

  const fetchRecentActivities = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);
      
      // Get recent bookshelf logs
      const { data: activities, error } = await supabase
        .from('bookshelf_logs')
        .select(`
          created_at,
          status,
          theses (
            title
          )
        `)
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching activities:', error);
        return;
      }

      if (activities) {
        const formattedActivities = activities.map((activity, index) => ({
          id: index + 1,
          thesisTitle: activity.theses?.title || 'Unknown Thesis',
          action: activity.status === 'borrowed' ? 'Borrowed' : 
                  activity.status === 'returned' ? 'Returned' : 'Viewed',
          time: new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date(activity.created_at).toLocaleDateString()
        }));
        setRecentActivities(formattedActivities);
      }

    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const fetchUserStats = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);

      // Get bookshelf logs count
      const { count: bookshelfCount } = await supabase
        .from('bookshelf_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', user.user_id);

      // Get access requests count
      const { count: accessCount } = await supabase
        .from('thesis_access_requests')
        .select('*', { count: 'exact' })
        .eq('user_id', user.user_id);

      setStats({
        papersViewed: bookshelfCount || 0,
        accessRequests: accessCount || 0,
        bookshelfLogs: bookshelfCount || 0
      });

    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
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

  // Get student details if available
  const studentInfo = userDetails?.students?.[0];
  const displayName = userDetails?.full_name || user?.full_name || 'User';
  const displayCollege = studentInfo?.college_department || 'No college specified';
  const displayCourse = studentInfo?.course || 'No course specified';
  const displayYearLevel = studentInfo?.year_level || '';
  const studentId = studentInfo?.student_id || 'N/A';

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ImageBackground 
          source={require('../assets/origbg1.png')} 
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </ImageBackground>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.headerTitle}>Profile</Text>
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

              {/* User Info in Side Navigation */}
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{displayName}</Text>
                <Text style={styles.userRole}>{userRole === 'admin' ? 'Administrator' : 'Student'}</Text>
                {studentInfo && (
                  <>
                    <Text style={styles.userDetail}>Department: {displayCollege}</Text>
                    <Text style={styles.userDetail}>Course: {displayCourse}</Text>
                  </>
                )}
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
                  style={[styles.menuItem, styles.activeMenuItem]}
                  onPress={() => handleNavigation('Profile')}
                >
                  <Icon name="account" size={responsiveSize(20)} color="#dc3545" />
                  <Text style={[styles.menuItemText, styles.activeMenuItemText]}>Profile</Text>
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Header Section */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {displayName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.college}>{displayCollege}</Text>
            <Text style={styles.course}>{displayCourse}</Text>
            {displayYearLevel ? (
              <Text style={styles.yearLevel}>Year {displayYearLevel}</Text>
            ) : null}
            <Text style={styles.studentId}>Student ID: {studentId}</Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('QRScanner')}
              >
                <Icon name="qrcode-scan" size={responsiveSize(24)} color="#dc3545" />
                <Text style={styles.actionText}>Scan QR</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('AccountSettings')}
              >
                <Icon name="account-edit" size={responsiveSize(24)} color="#dc3545" />
                <Text style={styles.actionText}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('Home')}
              >
                <Icon name="home" size={responsiveSize(24)} color="#dc3545" />
                <Text style={styles.actionText}>Home</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.papersViewed}</Text>
              <Text style={styles.statLabel}>Papers Viewed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.accessRequests}</Text>
              <Text style={styles.statLabel}>Access Requests</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.bookshelfLogs}</Text>
              <Text style={styles.statLabel}>Bookshelf Logs</Text>
            </View>
          </View>

          {/* Recent Activities Section */}
          <View style={styles.recentActivities}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            
            {recentActivities.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="history" size={responsiveSize(40)} color="#999" />
                <Text style={styles.emptyStateText}>No recent activities</Text>
                <Text style={styles.emptyStateSubtext}>Your thesis interactions will appear here</Text>
              </View>
            ) : (
              recentActivities.map((activity) => (
                <View key={activity.id} style={styles.activityCard}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityAction}>{activity.action}</Text>
                    <View style={styles.activityTime}>
                      <Text style={styles.timeText}>{activity.time}</Text>
                      <Text style={styles.dateText}>{activity.date}</Text>
                    </View>
                  </View>
                  <Text style={styles.activityThesis} numberOfLines={2}>
                    {activity.thesisTitle}
                  </Text>
                </View>
              ))
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
    shadowOffset: { width: 0, height: 2 },
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
  activeMenuItem: {
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#dc3545',
  },
  menuItemText: {
    fontSize: responsiveSize(16),
    color: '#333',
    marginLeft: responsiveSize(10),
  },
  activeMenuItemText: {
    color: '#dc3545',
    fontWeight: '600',
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
  content: {
    flex: 1,
    padding: responsiveSize(16),
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: responsiveSize(16),
    marginTop: responsiveSize(16),
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: responsiveSize(20),
    borderRadius: responsiveSize(12),
    marginBottom: responsiveSize(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderLeftWidth: responsiveSize(4),
    borderLeftColor: '#dc3545',
  },
  avatarContainer: {
    marginBottom: responsiveSize(12),
  },
  avatar: {
    width: responsiveSize(80),
    height: responsiveSize(80),
    borderRadius: responsiveSize(40),
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatarText: {
    color: '#fff',
    fontSize: responsiveSize(24),
    fontWeight: 'bold',
  },
  userName: {
    fontSize: responsiveSize(20),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: responsiveSize(4),
    textAlign: 'center',
  },
  college: {
    fontSize: responsiveSize(14),
    color: '#666',
    textAlign: 'center',
    marginBottom: responsiveSize(2),
  },
  course: {
    fontSize: responsiveSize(14),
    color: '#666',
    textAlign: 'center',
    marginBottom: responsiveSize(2),
  },
  yearLevel: {
    fontSize: responsiveSize(14),
    color: '#666',
    textAlign: 'center',
    marginBottom: responsiveSize(4),
  },
  studentId: {
    fontSize: responsiveSize(12),
    color: '#999',
    textAlign: 'center',
  },
  actionsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: responsiveSize(16),
    borderRadius: responsiveSize(12),
    marginBottom: responsiveSize(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderLeftWidth: responsiveSize(4),
    borderLeftColor: '#dc3545',
  },
  cardTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: responsiveSize(12),
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    padding: responsiveSize(8),
  },
  actionText: {
    marginTop: responsiveSize(6),
    fontSize: responsiveSize(12),
    color: '#666',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: responsiveSize(16),
    borderRadius: responsiveSize(12),
    marginBottom: responsiveSize(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderLeftWidth: responsiveSize(4),
    borderLeftColor: '#dc3545',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: responsiveSize(20),
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: responsiveSize(4),
  },
  statLabel: {
    fontSize: responsiveSize(12),
    color: '#666',
    textAlign: 'center',
  },
  recentActivities: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: responsiveSize(16),
    borderRadius: responsiveSize(12),
    marginBottom: responsiveSize(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderLeftWidth: responsiveSize(4),
    borderLeftColor: '#dc3545',
  },
  sectionTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#333',
    marginBottom: responsiveSize(12),
  },
  activityCard: {
    backgroundColor: '#f8f9fa',
    padding: responsiveSize(12),
    borderRadius: responsiveSize(8),
    marginBottom: responsiveSize(8),
    borderLeftWidth: responsiveSize(4),
    borderLeftColor: '#dc3545',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: responsiveSize(6),
  },
  activityAction: {
    fontSize: responsiveSize(12),
    fontWeight: '600',
    color: '#dc3545',
    backgroundColor: '#ffe6e6',
    paddingHorizontal: responsiveSize(6),
    paddingVertical: responsiveSize(2),
    borderRadius: responsiveSize(4),
  },
  activityTime: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: responsiveSize(12),
    fontWeight: '600',
    color: '#333',
  },
  dateText: {
    fontSize: responsiveSize(11),
    color: '#666',
  },
  activityThesis: {
    fontSize: responsiveSize(14),
    color: '#333',
    lineHeight: responsiveSize(18),
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
  userDetail: {
    fontSize: responsiveSize(12),
    color: '#666',
    marginTop: responsiveSize(2),
  },
});

export default ProfileScreen;